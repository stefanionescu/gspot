// Reading a repository's Prettier configuration into policy data, with the settings gspot does not model kept as extra.
import type { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import * as bundledPrettier from 'prettier';
import { createRequire } from 'node:module';
import { compact } from '#cli/policy/normalize.ts';
import { basename, dirname, join } from 'node:path';
import { CARRIED_REASON } from '#cli/policy/reasons.ts';
import type { ConfinedRoot } from '#cli/types/platform.ts';
import { prettierOptions } from '#cli/generation/format.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { CarriedFormatter } from '#cli/types/policy/adoption.ts';
import type { prettierIgnoreRequest } from '#cli/evaluation/protocol.ts';
import { literalGlob, relocatedOverrides } from '#cli/generation/relocated-overrides.ts';
import { formatFields, formatRequest, prettierSettings, prettierSource } from '#cli/evaluation/protocol.ts';

import type {
    Base,
    Carried,
    FormatRequest,
    NestedInput,
    Parsed,
    PrettierOverride,
    Source,
} from '#cli/types/evaluation.ts';

// Git precedence: a nested ignore line is relative to its folder and follows the lines of every ancestor file.
function rebasedIgnoreLine(line: string, folder: string): string {
    if (line.trim() === '' || line.startsWith('#')) return line;
    const isNegated = line.startsWith('!');
    const pattern = isNegated ? line.slice(1) : line;
    const body = pattern.startsWith('/') ? pattern.slice(1) : pattern;
    const isAnchored = pattern.startsWith('/') || body.replace(/\/$/u, '').includes('/');
    const directory = folder.replaceAll(/[\\*?[\]]/gu, String.raw`\$&`);
    return `${isNegated ? '!' : ''}/${directory}/${isAnchored ? '' : '**/'}${body}`;
}

function supportedOptions(value: unknown): Base {
    const parsed = prettierSettings.safeParse(value);
    if (!parsed.success)
        throw new Error(
            `Formatter configuration cannot be replaced without losing settings: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
        );
    return parsed.data;
}

async function projectPrettier(root: string): Promise<typeof bundledPrettier> {
    let implementation: string;
    try {
        implementation = createRequire(join(root, 'package.json')).resolve('prettier');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') return bundledPrettier;
        throw error;
    }
    const loaded = (await import(pathToFileURL(implementation).href)) as typeof bundledPrettier;
    if (
        typeof loaded.resolveConfig !== 'function' ||
        typeof loaded.getSupportInfo !== 'function' ||
        typeof loaded.getFileInfo !== 'function'
    )
        throw new Error('The installed Prettier does not expose its configuration API. Repair that installation.');
    return loaded;
}
// The Prettier options the policy models as format fields; every other option is carried under extra.
const MODELED_OPTIONS = new Set([
    'tabWidth',
    'printWidth',
    'trailingComma',
    'endOfLine',
    'semi',
    'useTabs',
    'singleQuote',
]);
const MODULE_CONFIGURATION = /\.[cm]?[jt]s$/u;
const PACKAGE_CONFIGURATION = /^package\.(?:json|yaml)$/u;

// The ignore lines of every observed ignore file, each nested file's lines rebased onto its folder.
function ignoreLines(files: ConfinedRoot, ignorePaths: string[]): string[] {
    return ignorePaths.flatMap((path) => {
        const observed = files.read(path);
        if (observed === undefined)
            throw new Error(`The observed formatter ignore file is missing: ${path}. Retry adoption.`);
        const folder = dirname(path).replaceAll('\\', '/');
        const lines = observed.bytes.toString('utf8').split(/\r?\n/u);
        return folder === '.' ? lines : lines.map((line) => rebasedIgnoreLine(line, folder));
    });
}

// The settings a module or package configuration declares, loaded the way Prettier resolves them.
async function loadedSource(
    prettier: typeof bundledPrettier,
    files: ConfinedRoot,
    root: string,
    from: string,
): Promise<Source> {
    const configuration = files.read(from);
    if (configuration === undefined)
        throw new Error(`The observed formatter configuration is missing: ${from}. Retry adoption.`);
    const configPath = await prettier.resolveConfigFile(join(root, dirname(from), 'gspot-import.js'));
    if (configPath !== join(root, from))
        throw new Error(`The active Prettier configuration differs from the observed ${from}.`);
    let loaded: unknown;
    if (MODULE_CONFIGURATION.test(from))
        loaded = ((await import(pathToFileURL(configPath).href)) as { default: unknown }).default;
    else if (PACKAGE_CONFIGURATION.test(basename(from)))
        loaded = (parseYaml(configuration.bytes.toString('utf8')) as { prettier?: unknown }).prettier;
    else
        throw new Error(
            `Formatter conversion does not support ${from}. Convert it to JSON, YAML, TOML, or a module before adoption.`,
        );
    return formatRequest.shape.source.unwrap().parse(loaded);
}

// Prettier's own defaults for the supported settings, or none when the policy keeps Prettier's defaults native.
async function nativeDefaults(prettier: typeof bundledPrettier, isNative: boolean): Promise<Record<string, unknown>> {
    if (isNative) return {};
    const supported = new Set(Object.keys(prettierSettings.shape));
    const info = await prettier.getSupportInfo();
    const entries = info.options
        .filter((option) => option.name !== undefined && supported.has(option.name))
        .map((option): [string, unknown] => [option.name ?? '', option.default]);
    return Object.fromEntries(entries);
}

// A two-way setting as the policy spells it, or undefined when the source leaves it out.
function choice<Value>(flag: boolean | undefined, whenTrue: Value, whenFalse: Value): Value | undefined {
    if (flag === undefined) return undefined;
    return flag ? whenTrue : whenFalse;
}

// The policy fields the base settings settle.
function policyFormat(base: Base, parsed: Parsed): CarriedFormatter['format'] {
    const { indent, width, ending } = parsed;
    return compact({
        indent_width: indent.success ? indent.data : undefined,
        print_width: width.success ? width.data : undefined,
        trailing_comma: base.trailingComma,
        line_ending: ending.success ? ending.data : undefined,
        semicolons: base.semi,
        indent_style: choice(base.useTabs, 'tab', 'space'),
        quotes: choice(base.singleQuote, 'single', 'double'),
    });
}

// The settings that stay Prettier's own under extra: unmodeled options, overrides, and values the policy cannot hold.
function extraSettings(base: Base, parsed: Parsed, overrides: PrettierOverride[]): Record<string, unknown> {
    const { tabWidth, printWidth, endOfLine } = base;
    const native = Object.fromEntries(Object.entries(base).filter(([key]) => !MODELED_OPTIONS.has(key)));
    return compact({
        ...native,
        overrides: overrides.length === 0 ? undefined : overrides,
        tabWidth: parsed.indent.success ? undefined : tabWidth,
        printWidth: parsed.width.success ? undefined : printWidth,
        endOfLine: parsed.ending.success ? undefined : endOfLine,
    });
}

// The policy fields the source settles, and the settings that stay Prettier's own under extra.
function carriedSettings(source: Source, defaults: Record<string, unknown>): Carried {
    const { overrides = [], ...raw } = source;
    const base = supportedOptions({ ...defaults, ...raw });
    const parsed: Parsed = {
        indent: formatFields.indent_width.safeParse(base.tabWidth),
        width: formatFields.print_width.safeParse(base.printWidth),
        ending: formatFields.line_ending.safeParse(base.endOfLine),
    };
    return { format: policyFormat(base, parsed), extra: extraSettings(base, parsed, overrides) };
}

// The root configuration followed by each nested one, evaluated on its own.
async function nestedInputs(request: FormatRequest, top: NestedInput): Promise<NestedInput[]> {
    const inputs = [top];
    for (const input of request.nested ?? []) {
        const settings = await evaluateFormat({
            root: request.root,
            from: input.from,
            nativeDefaults: request.nativeDefaults,
            ...(input.source === undefined ? {} : { source: input.source }),
        });
        inputs.push({ from: input.from, settings });
    }
    return inputs;
}

// The folder a configuration governs.
function folderOf(input: NestedInput): string {
    return dirname(input.from).replaceAll('\\', '/');
}

// The globs of the nested folders a configuration's folder must leave to their own configuration.
function childExclusions(inputs: NestedInput[], folder: string): string[] {
    return inputs
        .map((entry) => folderOf(entry))
        .filter((child) => child !== folder && child !== '.' && (folder === '.' || child.startsWith(`${folder}/`)))
        .map((child) => `${literalGlob(child)}/**/*`);
}

// The exclusions an override already names, as a list.
function excludedOf(override: PrettierOverride): string[] {
    if (override.excludeFiles === undefined) return [];
    return typeof override.excludeFiles === 'string' ? [override.excludeFiles] : override.excludeFiles;
}

// The overrides one configuration contributes: its settings for its folder, then its own overrides relocated there.
function overridesOf(input: NestedInput, inputs: NestedInput[]): PrettierOverride[] {
    const folder = folderOf(input);
    const exclusions = childExclusions(inputs, folder);
    const { overrides: childOverrides = [], ...carried } = input.settings.extra ?? {};
    const options = Object.fromEntries(Object.entries(carried).filter(([key]) => key !== 'reason'));
    const own: PrettierOverride = {
        files: folder === '.' ? '**/*' : `${literalGlob(folder)}/**/*`,
        excludeFiles: exclusions,
        options: supportedOptions({ ...prettierOptions(input.settings.format), ...options }),
    };
    const relocated = relocatedOverrides(prettierSource.shape.overrides.unwrap().parse(childOverrides), folder, '');
    return [
        own,
        ...relocated.map((override) => ({ ...override, excludeFiles: [...excludedOf(override), ...exclusions] })),
    ];
}

/**
 * Preserve native formatting defaults and nested overrides as policy data.
 * @param request the repository root, the formatter configuration to read, and its ignore files
 * @returns the carried formatter settings
 */
export async function evaluateFormat(request: FormatRequest): Promise<CarriedFormatter> {
    const { root, from, ignorePaths = [] } = request;
    const files = openConfinedRoot(root);
    try {
        const ignored = ignorePaths.length === 0 ? {} : { ignorePatterns: ignoreLines(files, ignorePaths) };
        const prettier = await projectPrettier(root);
        const source = request.source ?? (await loadedSource(prettier, files, root, from));
        const { format, extra } = carriedSettings(
            source,
            await nativeDefaults(prettier, request.nativeDefaults === true),
        );
        const reason = CARRIED_REASON.replaceAll('{{file}}', () => from);
        if ((request.nested?.length ?? 0) > 0) {
            const inputs = await nestedInputs(request, { from, settings: { format, extra } });
            const overrides = inputs.flatMap((input) => overridesOf(input, inputs));
            return { format: {}, ...ignored, extra: { reason, overrides } };
        }
        return { format, ...ignored, ...(Object.keys(extra).length === 0 ? {} : { extra: { reason, ...extra } }) };
    } finally {
        files.close();
    }
}

/**
 * Resolve the pinned formatter's exclusions without loading executable formatting configuration.
 * @param request the repository root and the ignore file to read
 * @returns the ignored paths
 */
export async function evaluateIgnoredPaths(request: z.infer<typeof prettierIgnoreRequest>): Promise<string[]> {
    if (openConfinedRoot(request.root).read(request.ignorePath) === undefined)
        throw new Error(`The observed formatter ignore file is missing: ${request.ignorePath}. Retry adoption.`);
    const ignored: string[] = [];
    for (const path of request.paths) {
        const info = await bundledPrettier.getFileInfo(join(request.root, path), {
            ignorePath: join(request.root, request.ignorePath),
            resolveConfig: false,
        });
        if (info.ignored) ignored.push(path);
    }
    return ignored;
}

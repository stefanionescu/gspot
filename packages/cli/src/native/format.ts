// Reading a repository's Prettier configuration into policy data, with the settings gspot does not model kept as extra.
import type { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import * as bundledPrettier from 'prettier';
import { createRequire } from 'node:module';
import type { Root } from '#cli/types/platform.ts';
import { compact } from '#cli/policy/normalize.ts';
import { join, dirname, basename } from 'node:path';
import { openRoot } from '#cli/platform/filesystem.ts';
import { KEPT_REASON } from '#cli/config/policy/policy.ts';
import type { prettierIgnoreRequest } from '#cli/native/protocol.ts';
import type { AdoptedFormatting } from '#cli/types/policy/adoption.ts';
import { prettierOptions } from '#cli/generation/formatting/settings.ts';
import { literalGlob, rebaseOverrides } from '#cli/generation/formatting/selectors.ts';
import { MODELED_OPTIONS, MODULE_CONFIGURATION, PACKAGE_CONFIGURATION } from '#cli/config/native.ts';
import { formatFields, formatRequest, prettierSource, prettierSettings } from '#cli/native/protocol.ts';

import type {
    Base,
    Parsed,
    Source,
    NestedInput,
    FormatRequest,
    PrettierOverride,
    FormatterSettings,
} from '#cli/types/native.ts';

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
    const prettier = (await import(pathToFileURL(implementation).href)) as typeof bundledPrettier;
    if (
        typeof prettier.resolveConfig !== 'function' ||
        typeof prettier.getSupportInfo !== 'function' ||
        typeof prettier.getFileInfo !== 'function'
    )
        throw new Error('The installed Prettier does not expose its configuration API. Repair that installation.');
    return prettier;
}

// The ignore lines of every read ignore file, each nested file's lines rebased onto its folder.
function ignoreLines(files: Root, ignorePaths: string[]): string[] {
    return ignorePaths.flatMap((path) => {
        const read = files.read(path);
        if (read === undefined) throw new Error(`The read formatter ignore file is missing: ${path}. Retry adoption.`);
        const folder = dirname(path).replaceAll('\\', '/');
        const lines = read.bytes.toString('utf8').split(/\r?\n/u);
        return folder === '.' ? lines : lines.map((line) => rebasedIgnoreLine(line, folder));
    });
}

// The settings a module or package configuration declares, loaded the way Prettier resolves them.
async function evaluatedSource(
    prettier: typeof bundledPrettier,
    files: Root,
    root: string,
    from: string,
): Promise<Source> {
    const configuration = files.read(from);
    if (configuration === undefined)
        throw new Error(`The read formatter configuration is missing: ${from}. Retry adoption.`);
    const configPath = await prettier.resolveConfigFile(join(root, dirname(from), 'gspot-import.js'));
    if (configPath !== join(root, from))
        throw new Error(`The active Prettier configuration differs from the read ${from}.`);
    let source: unknown;
    if (MODULE_CONFIGURATION.test(from))
        source = ((await import(pathToFileURL(configPath).href)) as { default: unknown }).default;
    else if (PACKAGE_CONFIGURATION.test(basename(from)))
        source = (parseYaml(configuration.bytes.toString('utf8')) as { prettier?: unknown }).prettier;
    else
        throw new Error(
            `Formatter conversion does not support ${from}. Convert it to JSON, YAML, TOML, or a module before adoption.`,
        );
    return formatRequest.shape.source.unwrap().parse(source);
}

// Explicit Prettier defaults, or none when the policy retains native defaults.
async function nativeDefaults(prettier: typeof bundledPrettier, isNative: boolean): Promise<Record<string, unknown>> {
    if (isNative) return {};
    const supported = new Set(Object.keys(prettierSettings.shape));
    const optionDefinitions = await prettier.getSupportInfo();
    const entries = optionDefinitions.options
        .filter((option) => option.name !== undefined && supported.has(option.name))
        .map((option): [string, unknown] => [option.name ?? '', option.default]);
    return Object.fromEntries(entries);
}

// A two-way setting as the policy spells it, or undefined when the source leaves it out.
function choice<Value>(flag: boolean | undefined, enabled: Value, disabled: Value): Value | undefined {
    if (flag === undefined) return undefined;
    return flag ? enabled : disabled;
}

// Native Prettier settings under extra: unmodeled options, overrides, and unsupported policy values.
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

// Policy fields derived from the source and native Prettier settings retained under extra.
function formattingSettings(source: Source, defaults: Record<string, unknown>): FormatterSettings {
    const { overrides = [], ...raw } = source;
    const base = supportedOptions({ ...defaults, ...raw });
    const parsed: Parsed = {
        indent: formatFields.indent_width.safeParse(base.tabWidth),
        width: formatFields.print_width.safeParse(base.printWidth),
        ending: formatFields.line_ending.safeParse(base.endOfLine),
    };
    const { indent, width, ending } = parsed;
    const format: AdoptedFormatting['format'] = compact({
        indent_width: indent.success ? indent.data : undefined,
        print_width: width.success ? width.data : undefined,
        trailing_comma: base.trailingComma,
        line_ending: ending.success ? ending.data : undefined,
        semicolons: base.semi,
        indent_style: choice(base.useTabs, 'tab', 'space'),
        quotes: choice(base.singleQuote, 'single', 'double'),
    });
    return { format, extra: extraSettings(base, parsed, overrides) };
}

// The root configuration followed by each nested one, evaluated on its own.
async function nestedInputs(request: FormatRequest, top: NestedInput): Promise<NestedInput[]> {
    const inputs = [top];
    for (const input of request.nested ?? []) {
        const settings = await runFormat({
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Builds a template; inlining it nests a template inside a template.
function folderOf(input: NestedInput): string {
    return dirname(input.from).replaceAll('\\', '/');
}

// The exclusions an override already names, as a list.
function excludedOf(override: PrettierOverride): string[] {
    if (override.excludeFiles === undefined) return [];
    return typeof override.excludeFiles === 'string' ? [override.excludeFiles] : override.excludeFiles;
}

// The overrides one configuration contributes: its settings for its folder, then its own overrides relocated there.
function overridesOf(input: NestedInput, inputs: NestedInput[]): PrettierOverride[] {
    const folder = folderOf(input);
    const exclusions = inputs
        .map((entry) => folderOf(entry))
        .filter((child) => child !== folder && child !== '.' && (folder === '.' || child.startsWith(`${folder}/`)))
        .map((child) => `${literalGlob(child)}/**/*`);
    const { overrides: childOverrides = [], ...kept } = input.settings.extra ?? {};
    const options = Object.fromEntries(Object.entries(kept).filter(([key]) => key !== 'reason'));
    const own: PrettierOverride = {
        files: folder === '.' ? '**/*' : `${literalGlob(folder)}/**/*`,
        excludeFiles: exclusions,
        options: supportedOptions({ ...prettierOptions(input.settings.format), ...options }),
    };
    const relocated = rebaseOverrides(prettierSource.shape.overrides.unwrap().parse(childOverrides), folder, '');
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
export async function runFormat(request: FormatRequest): Promise<AdoptedFormatting> {
    const { root, from, ignorePaths = [] } = request;
    const files = openRoot(root);
    try {
        const ignored = ignorePaths.length === 0 ? {} : { ignorePatterns: ignoreLines(files, ignorePaths) };
        const prettier = await projectPrettier(root);
        const source = request.source ?? (await evaluatedSource(prettier, files, root, from));
        const { format, extra } = formattingSettings(
            source,
            await nativeDefaults(prettier, request.nativeDefaults === true),
        );
        const reason = KEPT_REASON.replaceAll('{{file}}', () => from);
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
export async function runIgnoredPaths(request: z.infer<typeof prettierIgnoreRequest>): Promise<string[]> {
    if (openRoot(request.root).read(request.ignorePath) === undefined)
        throw new Error(`The read formatter ignore file is missing: ${request.ignorePath}. Retry adoption.`);
    const ignored: string[] = [];
    for (const path of request.paths) {
        const classification = await bundledPrettier.getFileInfo(join(request.root, path), {
            ignorePath: join(request.root, request.ignorePath),
            resolveConfig: false,
        });
        if (classification.ignored) ignored.push(path);
    }
    return ignored;
}

import type { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import * as bundledPrettier from 'prettier';
import { createRequire } from 'node:module';
import { compact } from '#cli/policy/normalize.ts';
import { basename, dirname, join } from 'node:path';
import { CARRIED_REASON } from '#cli/policy/reasons.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { CarriedFormatter } from '#cli/policy/adoption/results.ts';
import type { prettierIgnoreRequest } from '#cli/evaluation/protocol.ts';
import { literalGlob, prettierOptions, relocatedOverrides } from '#cli/generation/format.ts';
import { formatFields, formatRequest, prettierSettings, prettierSource } from '#cli/evaluation/protocol.ts';

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

function supportedOptions(value: unknown) {
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
/**
 * Preserve native formatting defaults and nested overrides as policy data.
 * @param request
 */
export async function evaluateFormat(request: z.infer<typeof formatRequest>): Promise<CarriedFormatter> {
    const { root, from, ignorePaths = [] } = request;
    const files = openConfinedRoot(root);
    const ignoreLines = ignorePaths.flatMap((path) => {
        const observed = files.read(path);
        if (observed === undefined)
            throw new Error(`The observed formatter ignore file is missing: ${path}. Retry adoption.`);
        const folder = dirname(path).replaceAll('\\', '/');
        const lines = observed.bytes.toString('utf8').split(/\r?\n/u);
        return folder === '.' ? lines : lines.map((line) => rebasedIgnoreLine(line, folder));
    });
    const ignored = ignorePaths.length === 0 ? {} : { ignorePatterns: ignoreLines };
    let source = request.source;
    const prettier = await projectPrettier(root);
    if (source === undefined) {
        const configuration = files.read(from);
        if (configuration === undefined)
            throw new Error(`The observed formatter configuration is missing: ${from}. Retry adoption.`);
        const configPath = await prettier.resolveConfigFile(join(root, dirname(from), 'gspot-import.js'));
        if (configPath !== join(root, from))
            throw new Error(`The active Prettier configuration differs from the observed ${from}.`);
        let loaded: unknown;
        if (/\.[cm]?[jt]s$/u.test(from))
            loaded = ((await import(pathToFileURL(configPath).href)) as { default: unknown }).default;
        else if (/^package\.(?:json|yaml)$/u.test(basename(from)))
            loaded = (parseYaml(configuration.bytes.toString('utf8')) as { prettier?: unknown }).prettier;
        else
            throw new Error(
                `Formatter conversion does not support ${from}. Convert it to JSON, YAML, TOML, or a module before adoption.`,
            );
        source = formatRequest.shape.source.unwrap().parse(loaded);
    }
    const supported = new Set(Object.keys(prettierSettings.shape));
    const defaults =
        request.nativeDefaults === true
            ? {}
            : Object.fromEntries(
                  (await prettier.getSupportInfo()).options
                      .filter((option) => option.name !== undefined && supported.has(option.name))
                      .map((option) => [option.name, option.default]),
              );
    const { overrides = [], ...raw } = source;
    const base = supportedOptions({ ...defaults, ...raw });
    const { tabWidth, printWidth, trailingComma, endOfLine, semi, useTabs, singleQuote, ...native } = base;
    const indent = formatFields.indent_width.safeParse(tabWidth);
    const width = formatFields.print_width.safeParse(printWidth);
    const ending = formatFields.line_ending.safeParse(endOfLine);
    const extra = compact({
        ...native,
        overrides: overrides.length === 0 ? undefined : overrides,
        tabWidth: indent.success ? undefined : tabWidth,
        printWidth: width.success ? undefined : printWidth,
        endOfLine: ending.success ? undefined : endOfLine,
    });
    const format: CarriedFormatter['format'] = compact({
        indent_width: indent.success ? indent.data : undefined,
        print_width: width.success ? width.data : undefined,
        trailing_comma: trailingComma,
        line_ending: ending.success ? ending.data : undefined,
        semicolons: semi,
        indent_style: useTabs === undefined ? undefined : useTabs ? 'tab' : 'space',
        quotes: singleQuote === undefined ? undefined : singleQuote ? 'single' : 'double',
    });
    const ordered = [...overrides];
    if ((request.nested?.length ?? 0) > 0) {
        ordered.length = 0;
        const inputs: { from: string; settings: CarriedFormatter }[] = [{ from, settings: { format, extra } }];
        for (const input of request.nested ?? [])
            inputs.push({
                from: input.from,
                settings: await evaluateFormat({
                    root,
                    from: input.from,
                    nativeDefaults: request.nativeDefaults,
                    ...(input.source === undefined ? {} : { source: input.source }),
                }),
            });
        for (const input of inputs) {
            const folder = dirname(input.from).replaceAll('\\', '/');
            const children = inputs
                .map((entry) => dirname(entry.from).replaceAll('\\', '/'))
                .filter(
                    (child) => child !== folder && child !== '.' && (folder === '.' || child.startsWith(`${folder}/`)),
                );
            const exclusions = children.map((child) => `${literalGlob(child)}/**/*`);
            const { overrides: childOverrides = [], reason: _reason, ...options } = input.settings.extra ?? {};
            ordered.push({
                files: folder === '.' ? '**/*' : `${literalGlob(folder)}/**/*`,
                excludeFiles: exclusions,
                options: supportedOptions({ ...prettierOptions(input.settings.format), ...options }),
            });
            for (const override of relocatedOverrides(
                prettierSource.shape.overrides.unwrap().parse(childOverrides),
                folder,
                '',
            )) {
                const excluded =
                    override.excludeFiles === undefined
                        ? []
                        : typeof override.excludeFiles === 'string'
                          ? [override.excludeFiles]
                          : override.excludeFiles;
                ordered.push({ ...override, excludeFiles: [...excluded, ...exclusions] });
            }
        }
        return {
            format: {},
            ...ignored,
            extra: { reason: CARRIED_REASON.replaceAll('{{file}}', () => from), overrides: ordered },
        };
    }
    if (ordered.length > 0) extra.overrides = ordered;
    return {
        format,
        ...ignored,
        ...(Object.keys(extra).length === 0
            ? {}
            : { extra: { reason: CARRIED_REASON.replaceAll('{{file}}', () => from), ...extra } }),
    };
}
/**
 * Resolve the pinned formatter's exclusions without loading executable formatting configuration.
 * @param request
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

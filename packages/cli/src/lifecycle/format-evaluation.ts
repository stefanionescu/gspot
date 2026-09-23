import { z } from 'zod';
import { join, dirname, basename } from 'node:path';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { parse as parseYaml } from 'yaml';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import * as bundledPrettier from 'prettier';
import { CARRIED_REASON } from '#cli/policy/reasons-definitions.ts';
import type { CarriedFormatter } from '#cli/lifecycle/types.ts';
import { compact } from '#cli/policy/normalize.ts';
import { prettierOptions, relocatedOverrides, literalGlob } from '#cli/emit/format.ts';
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
export async function evaluateFormat(request: z.infer<typeof formatRequest>): Promise<CarriedFormatter> {
    const { root, from, ignorePath } = request;
    const files = openConfinedRoot(root);
    const ignore = ignorePath === undefined ? undefined : files.read(ignorePath);
    if (ignorePath !== undefined && ignore === undefined)
        throw new Error(`The observed formatter ignore file is missing: ${ignorePath}. Retry adoption.`);
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
    const indent = fields.indent_width.safeParse(tabWidth);
    const width = fields.print_width.safeParse(printWidth);
    const ending = fields.line_ending.safeParse(endOfLine);
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
            ...(ignore === undefined ? {} : { ignorePatterns: ignore.bytes.toString('utf8').split(/\r?\n/u) }),
            extra: { reason: CARRIED_REASON.replaceAll('{{file}}', () => from), overrides: ordered },
        };
    }
    if (ordered.length > 0) extra.overrides = ordered;
    return {
        format,
        ...(ignore === undefined ? {} : { ignorePatterns: ignore.bytes.toString('utf8').split(/\r?\n/u) }),
        ...(Object.keys(extra).length === 0
            ? {}
            : { extra: { reason: CARRIED_REASON.replaceAll('{{file}}', () => from), ...extra } }),
    };
}
/** Resolve the pinned formatter's exclusions without loading executable formatting configuration. */
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
import { policySchema } from '#cli/policy/schema.ts';
const fields = policySchema.shape.format.unwrap().shape;
export const prettierSettings = z.strictObject({
    $schema: z.string().optional(),
    tabWidth: z.number().int().nonnegative().optional(),
    printWidth: z.number().int().nonnegative().optional(),
    trailingComma: fields.trailing_comma,
    endOfLine: z.enum(['lf', 'crlf', 'cr', 'auto']).optional(),
    semi: z.boolean().optional(),
    useTabs: z.boolean().optional(),
    singleQuote: z.boolean().optional(),
    arrowParens: z.enum(['always', 'avoid']).optional(),
    embeddedLanguageFormatting: z.enum(['auto', 'off']).optional(),
    bracketSpacing: z.boolean().optional(),
    bracketSameLine: z.boolean().optional(),
    htmlWhitespaceSensitivity: z.enum(['css', 'strict', 'ignore']).optional(),
    singleAttributePerLine: z.boolean().optional(),
    vueIndentScriptAndStyle: z.boolean().optional(),
    objectWrap: z.enum(['preserve', 'collapse']).optional(),
    experimentalOperatorPosition: z.enum(['start', 'end']).optional(),
    experimentalTernaries: z.boolean().optional(),
    jsxSingleQuote: z.boolean().optional(),
    quoteProps: z.enum(['as-needed', 'consistent', 'preserve']).optional(),
    proseWrap: z.enum(['always', 'never', 'preserve']).optional(),
    checkIgnorePragma: z.boolean().optional(),
    insertPragma: z.boolean().optional(),
    requirePragma: z.boolean().optional(),
    parser: z.string().min(1).optional(),
});
const prettierSource = prettierSettings.extend({
    overrides: z
        .array(
            z.strictObject({
                files: z.union([z.string(), z.array(z.string())]),
                excludeFiles: z.union([z.string(), z.array(z.string())]).optional(),
                options: prettierSettings,
            }),
        )
        .optional(),
});
export const formatRequest = z.strictObject({
    root: z.string().min(1),
    from: z.string().min(1),
    ignorePath: z.string().min(1).optional(),
    source: prettierSource.optional(),
    nativeDefaults: z.boolean().optional(),
    nested: z.array(z.strictObject({ from: z.string().min(1), source: prettierSource.optional() })).optional(),
});
export const prettierIgnoreRequest = z.strictObject({
    root: z.string().min(1),
    paths: z.array(z.string().min(1)),
    ignorePath: z.string().min(1),
});
export const ignoredPathsResponse = z.array(z.string().min(1));
export const formatResponse = z.strictObject({
    ignorePatterns: z.array(z.string()).optional(),
    format: policySchema.shape.format.unwrap(),
    extra: prettierSettings
        .extend({
            reason: z.string(),
            overrides: formatRequest.shape.source.unwrap().shape.overrides,
        })
        .optional(),
});
import type { CarrySource } from '#cli/lifecycle/types.ts';
import { evaluateConfiguration } from './configuration.ts';
export async function carryFormat(
    root: string,
    configurations: { from: string; source?: CarrySource }[],
    ignorePath?: string,
    nativeDefaults = false,
): Promise<CarriedFormatter> {
    const base = configurations.find((entry) => !entry.from.includes('/'));
    const from = base?.from ?? '.prettierrc.json';
    const source = base === undefined ? { parsed: {} } : base.source;
    const request = formatRequest.safeParse({
        root,
        from,
        nativeDefaults,
        ...(ignorePath === undefined ? {} : { ignorePath }),
        ...(source === undefined ? {} : { source: source.parsed }),
        nested: configurations
            .filter((entry) => entry.from.includes('/'))
            .toSorted((a, b) => a.from.split('/').length - b.from.split('/').length)
            .map((entry) => ({
                from: entry.from,
                ...(entry.source === undefined ? {} : { source: entry.source.parsed }),
            })),
    });
    if (!request.success)
        throw new Error(
            `Formatter configuration cannot be replaced without losing settings: ${request.error.issues.map((issue) => issue.message).join('; ')}`,
        );
    const parsed = formatResponse.parse(
        await evaluateConfiguration({ ...request.data, tool: 'prettier', operation: 'format' }),
    );
    return compact({
        format: compact(parsed.format),
        ignorePatterns: parsed.ignorePatterns,
        extra: parsed.extra === undefined ? undefined : compact(parsed.extra),
    });
}

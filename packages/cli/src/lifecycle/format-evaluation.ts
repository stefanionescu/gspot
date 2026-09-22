import { z } from 'zod';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import * as bundledPrettier from 'prettier';
import { CARRIED_REASON } from '#cli/policy/reasons-definitions.ts';
import type { CarriedFormatter } from '#cli/lifecycle/types.ts';
import type { FormatSettings } from '#cli/policy/types.ts';
import { compact } from '#cli/policy/normalize.ts';
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
    let source = request.source;
    const prettier = await projectPrettier(root);
    if (source === undefined) {
        const configPath = await prettier.resolveConfigFile(join(root, 'gspot-import.js'));
        if (configPath !== join(root, from))
            throw new Error(`The active Prettier configuration differs from the observed ${from}.`);
        let loaded: unknown;
        if (/\.[cm]?[jt]s$/u.test(from))
            loaded = ((await import(pathToFileURL(configPath).href)) as { default: unknown }).default;
        else if (/^package\.(?:json|yaml)$/u.test(from))
            loaded = (parseYaml(readFileSync(configPath, 'utf8')) as { prettier?: unknown }).prettier;
        else
            throw new Error(
                `Formatter conversion does not support ${from}. Convert it to JSON, YAML, TOML, or a module before adoption.`,
            );
        source = formatRequest.shape.source.unwrap().parse(loaded);
    }
    const supported = new Set(Object.keys(prettierSettings.shape));
    const defaults = Object.fromEntries(
        (await prettier.getSupportInfo()).options
            .filter((option) => option.name !== undefined && supported.has(option.name))
            .map((option) => [option.name, option.default]),
    );
    const { overrides = [], ...raw } = source;
    const base = supportedOptions({ ...defaults, ...raw });
    const extra = {
        ...(overrides.length === 0 ? {} : { overrides }),
        ...(base.arrowParens === 'avoid' ? { arrowParens: base.arrowParens } : {}),
        ...(base.embeddedLanguageFormatting === 'auto'
            ? { embeddedLanguageFormatting: base.embeddedLanguageFormatting }
            : {}),
    };
    const format: CarriedFormatter['format'] = compact({
        indent_width: base.tabWidth,
        print_width: base.printWidth,
        trailing_comma: base.trailingComma,
        line_ending: base.endOfLine,
        semicolons: base.semi,
        indent_style: base.useTabs === undefined ? undefined : base.useTabs ? 'tab' : 'space',
        quotes: base.singleQuote === undefined ? undefined : base.singleQuote ? 'single' : 'double',
    });
    return {
        format,
        ...(ignorePath === undefined
            ? {}
            : { ignorePatterns: readFileSync(join(root, ignorePath), 'utf8').split(/\r?\n/u) }),
        ...(Object.keys(extra).length === 0
            ? {}
            : { extra: { reason: CARRIED_REASON.replaceAll('{{file}}', () => from), ...extra } }),
    };
}
/** Resolve the pinned formatter's exclusions without loading executable formatting configuration. */
export async function evaluateIgnoredPaths(request: z.infer<typeof prettierIgnoreRequest>): Promise<string[]> {
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
    tabWidth: fields.indent_width,
    printWidth: fields.print_width,
    trailingComma: fields.trailing_comma,
    endOfLine: fields.line_ending,
    semi: z.boolean().optional(),
    useTabs: z.boolean().optional(),
    singleQuote: z.boolean().optional(),
    arrowParens: z.enum(['always', 'avoid']).optional(),
    embeddedLanguageFormatting: z.enum(['auto', 'off']).optional(),
});
export const formatRequest = z.strictObject({
    root: z.string().min(1),
    paths: z.array(z.string().min(1)),
    from: z.string().min(1),
    ignorePath: z.string().min(1).optional(),
    source: prettierSettings
        .extend({
            overrides: z
                .array(
                    z.strictObject({
                        files: z.union([z.string(), z.array(z.string())]),
                        excludeFiles: z.union([z.string(), z.array(z.string())]).optional(),
                        options: prettierSettings,
                    }),
                )
                .optional(),
        })
        .optional(),
});
export const prettierIgnoreRequest = formatRequest
    .pick({ root: true, paths: true })
    .extend({ ignorePath: z.string().min(1) });
export const ignoredPathsResponse = z.array(z.string().min(1));
export const formatResponse = z.strictObject({
    ignorePatterns: z.array(z.string()).optional(),
    format: policySchema.shape.format.unwrap(),
    extra: z
        .strictObject({
            reason: z.string(),
            overrides: formatRequest.shape.source.unwrap().shape.overrides,
            arrowParens: prettierSettings.shape.arrowParens,
            embeddedLanguageFormatting: prettierSettings.shape.embeddedLanguageFormatting,
        })
        .optional(),
});
import type { CarrySource } from '#cli/lifecycle/types.ts';
import { evaluateConfiguration } from './configuration.ts';
export async function carryFormat(
    root: string,
    paths: string[],
    from: string,
    source?: CarrySource,
    ignorePath?: string,
): Promise<CarriedFormatter> {
    const { overrides } = source?.parsed ?? {};
    if (overrides !== undefined && !Array.isArray(overrides))
        throw new Error('Prettier overrides must contain a list.');
    const request = formatRequest.safeParse({
        root,
        paths,
        from,
        ...(ignorePath === undefined ? {} : { ignorePath }),
        ...(source === undefined ? {} : { source: source.parsed }),
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

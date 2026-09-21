import { z } from 'zod';
import { join } from 'node:path';
import { convertPathToPattern } from 'globby';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import * as bundledPrettier from 'prettier';
import { CARRIED_REASON } from '#config/reasons.ts';
import type { CarriedFormatter } from '#types/lifecycle.ts';
import type { FormatSettings } from '#types/config.ts';
import { compact } from '#cli/policy/normalize.ts';
import { prettierSettings, formatRequest, prettierIgnoreRequest } from './format-request.ts';

function formatChoices(options: z.infer<typeof prettierSettings>): Partial<FormatSettings> {
    return compact({
        indent_width: options.tabWidth,
        print_width: options.printWidth,
        trailing_comma: options.trailingComma,
        line_ending: options.endOfLine,
        semicolons: options.semi,
        indent_style: options.useTabs === undefined ? undefined : options.useTabs ? 'tab' : 'space',
        quotes: options.singleQuote === undefined ? undefined : options.singleQuote ? 'single' : 'double',
    });
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

function extraOptions(options: z.infer<typeof prettierSettings>): Record<string, string> {
    return {
        ...(options.arrowParens === 'avoid' ? { arrowParens: options.arrowParens } : {}),
        ...(options.embeddedLanguageFormatting === 'auto'
            ? { embeddedLanguageFormatting: options.embeddedLanguageFormatting }
            : {}),
    };
}

export async function evaluateFormat(request: z.infer<typeof formatRequest>): Promise<CarriedFormatter> {
    const { root, paths, from, source, ignorePath } = request;
    const prettier = await projectPrettier(root);
    const supported = new Set(Object.keys(prettierSettings.shape));
    const defaults = Object.fromEntries(
        (await prettier.getSupportInfo()).options
            .filter((option) => option.name !== undefined && supported.has(option.name))
            .map((option) => [option.name, option.default]),
    );
    const base = supportedOptions({ ...defaults, ...(source === undefined ? {} : source) });
    const groups = new Map<string, { format: Partial<FormatSettings>; paths: string[] }>();
    let extra: Record<string, string> | undefined;
    const ignoredPaths: string[] = [];
    for (const file of paths) {
        if (
            ignorePath !== undefined &&
            (await prettier.getFileInfo(join(root, file), { ignorePath: join(root, ignorePath), resolveConfig: false }))
                .ignored
        ) {
            ignoredPaths.push(convertPathToPattern(file));
            continue;
        }
        const resolved = supportedOptions({
            ...defaults,
            ...(await prettier.resolveConfig(join(root, file), {
                ...(source === undefined ? {} : { config: join(root, from) }),
                editorconfig: true,
                useCache: false,
            })),
        });
        const options = extraOptions(resolved);
        if (extra !== undefined && !isDeepStrictEqual(extra, options))
            throw new Error('Tool-specific formatter options differ across paths and cannot be carried without loss.');
        extra = options;
        const format = formatChoices(resolved);
        const key = JSON.stringify(format);
        const group = groups.get(key) ?? { format, paths: [] };
        group.paths.push(convertPathToPattern(file));
        groups.set(key, group);
    }
    extra ??= extraOptions(base);
    const [single] = groups.values();
    const format =
        groups.size <= 1
            ? (single?.format ?? formatChoices(base))
            : {
                  ...formatChoices(base),
                  overrides: [...groups.values()].map((group) => ({ paths: group.paths, ...group.format })),
              };
    return {
        format,
        ignoredPaths,
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

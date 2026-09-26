import { dirname, relative } from 'node:path';
import { compact } from '#cli/policy/normalize.ts';
import { expandedPaths } from '#cli/repository/paths.ts';
import { shippedFormat } from '#cli/configurations/listing.ts';
import { NODE_MODULES_DIRECTORY } from '#cli/platform/paths.ts';
import type { FormatSettings, Policy } from '#cli/policy/normalize.ts';

type NativeOverride<Options> = {
    files: string | string[];
    excludeFiles?: string | string[] | undefined;
    options: Options;
};

function formatEntries(policy: Policy): ScopedFormat[] {
    const tables = [
        { scope: '', format: policy.format },
        ...Object.entries(policy.scopeTables).map(([scope, table]) => ({ scope, format: table.format ?? {} })),
    ].toSorted((first, second) => first.scope.split('/').length - second.scope.split('/').length);
    const base = tables.flatMap(({ scope, format: { overrides: _overrides, ...format } }) =>
        scope === '' || Object.keys(format).length === 0 ? [] : [{ scope, paths: ['**/*'], format }],
    );
    const overrides = tables.flatMap(({ scope, format }) =>
        (format.overrides ?? []).map(({ paths, ...format }) => ({ scope, paths, format: compact(format) })),
    );
    return [...base, ...overrides];
}

function editorconfigOptions(format: Partial<FormatSettings>): Record<string, string | number | boolean> {
    return {
        ...(format.indent_style === undefined ? {} : { indent_style: format.indent_style }),
        ...(format.indent_width === undefined ? {} : { indent_size: format.indent_width }),
        ...(format.line_ending === undefined ? {} : { end_of_line: format.line_ending }),
        ...(format.newline_at_end === undefined ? {} : { insert_final_newline: format.newline_at_end }),
    };
}

// A negation keeps its mark in front of the moved selector.
function relocated(pattern: string, place: (selector: string) => string): string {
    return pattern.startsWith('!') ? `!${place(pattern.slice(1))}` : place(pattern);
}

/**
 * Relocate native selectors while retaining Prettier's separate basename and relative-path matching.
 * @param entries the authored overrides
 * @param base the folder the authored file lived in, relative to the root
 * @param prefix the path from the generated file's folder back to the root
 * @returns the overrides with their selectors moved
 */
export function relocatedOverrides<Options>(
    entries: NativeOverride<Options>[],
    base: string,
    prefix: string,
): NativeOverride<Options>[] {
    const fromConfig = (pattern: string): string =>
        [prefix, literalGlob(base), pattern].filter((part) => part !== '' && part !== '.').join('/');
    return entries.flatMap((entry) => {
        const files = typeof entry.files === 'string' ? [entry.files] : entry.files;
        const excluded =
            entry.excludeFiles === undefined
                ? []
                : typeof entry.excludeFiles === 'string'
                  ? [entry.excludeFiles]
                  : entry.excludeFiles;
        return [false, true].flatMap((hasSlash) => {
            const patterns = files.filter((pattern) => pattern.includes('/') === hasSlash);
            if (patterns.length === 0) return [];
            if (!hasSlash && base === '') return [{ files: patterns, excludeFiles: excluded, options: entry.options }];
            // Prettier matches every exclusion of a basename group against the basename, where a slash never occurs.
            const basenames = excluded.map((pattern) => ({
                isNegated: pattern.startsWith('!'),
                basename: (pattern.startsWith('!') ? pattern.slice(1) : pattern).replace(/^(?:\*\*\/)+/u, ''),
            }));
            if (!hasSlash && basenames.some(({ basename }) => basename.includes('/') && /[{}()]/u.test(basename)))
                throw new Error(
                    'Prettier cannot relocate this basename exclusion without changing its meaning. Keep the original configuration active.',
                );
            // A negated exclusion that no basename matches excludes every file of the group.
            if (!hasSlash && basenames.some(({ isNegated, basename }) => isNegated && basename.includes('/')))
                return [];
            const exclusions = hasSlash
                ? excluded.map((pattern) => relocated(pattern, fromConfig))
                : basenames
                      .filter(({ basename }) => !basename.includes('/'))
                      .map(({ isNegated, basename }) => {
                          const moved = fromConfig(`**/${basename}`);
                          return `${isNegated ? '!' : ''}${moved}`;
                      });
            const place = (selector: string): string => fromConfig(hasSlash ? selector : `**/${selector}`);
            if (base === '')
                return [
                    {
                        files: patterns.map((pattern) => relocated(pattern, place)),
                        excludeFiles: exclusions,
                        options: entry.options,
                    },
                ];
            // Below a folder, a negated selector becomes the folder less that selector, so it reaches no file outside.
            const included = patterns.filter((pattern) => !pattern.startsWith('!'));
            const complements = patterns
                .filter((pattern) => pattern.startsWith('!'))
                .map((pattern) => ({
                    files: [fromConfig('**/*')],
                    excludeFiles: [place(pattern.slice(1)), ...exclusions],
                    options: entry.options,
                }));
            return [
                ...(included.length === 0
                    ? []
                    : [
                          {
                              files: included.map((selector) => place(selector)),
                              excludeFiles: exclusions,
                              options: entry.options,
                          },
                      ]),
                ...complements,
            ];
        });
    });
}

/**
 * The Prettier options for the format settings a policy states.
 * @param format the format settings, each optional
 * @returns the options Prettier reads, only for the settings given
 */
export function prettierOptions(format: Partial<FormatSettings>): Record<string, unknown> {
    return {
        ...(format.indent_width === undefined ? {} : { tabWidth: format.indent_width }),
        ...(format.indent_style === undefined ? {} : { useTabs: format.indent_style === 'tab' }),
        ...(format.print_width === undefined ? {} : { printWidth: format.print_width }),
        ...(format.quotes === undefined ? {} : { singleQuote: format.quotes === 'single' }),
        ...(format.trailing_comma === undefined ? {} : { trailingComma: format.trailing_comma }),
        ...(format.semicolons === undefined ? {} : { semi: format.semicolons }),
        ...(format.line_ending === undefined ? {} : { endOfLine: format.line_ending }),
    };
}

/**
 * A path as a glob that matches only itself.
 * @param path the literal path
 * @returns the path with every glob character escaped
 */
export function literalGlob(path: string): string {
    return path.replaceAll(/[\\*?{}[\]()!+@,]/gu, String.raw`\$&`);
}

/**
 * Generate each Prettier configuration relative to its own output path.
 * @param policy the repository policy
 * @param targetPath the path of the generated file
 * @param extra the authored Prettier settings the policy carries
 * @param plugins the Prettier plugins the selected manifests ship
 * @returns the Prettier configuration
 */
export function prettierConfig(
    policy: Policy,
    targetPath: string,
    extra: Record<string, unknown> | undefined,
    plugins: PrettierPlugin[],
): Record<string, unknown> {
    const prefix = relative(dirname(targetPath), '.').replaceAll('\\', '/');
    const fromConfig = (pattern: string): string => (prefix === '' ? pattern : `${prefix}/${pattern}`);
    // Prettier loads a plugin path that starts with a dot relative to the configuration file.
    const pluginPaths = plugins.map(
        (plugin) => `${prefix === '' ? '.' : prefix}/${NODE_MODULES_DIRECTORY}/${plugin.name}/${plugin.entry}`,
    );
    const pluginOverrides = plugins.flatMap((plugin) => plugin.overrides);
    const overrides = formatEntries(policy).map(({ scope, paths, format }) => {
        const expanded = expandedPaths(paths);
        const files = expanded.filter((path) => !path.startsWith('!')).map((path) => fromConfig(path));
        const excludeFiles = expanded.filter((path) => path.startsWith('!')).map((path) => fromConfig(path.slice(1)));
        if (scope !== '') excludeFiles.push(`!${fromConfig(literalGlob(scope))}/**`);
        return { files, excludeFiles, options: prettierOptions(format) };
    });
    const { overrides: nativeOverrides = [], ...carried } = extra ?? {};
    // The reason explains the override to a reader of the policy; Prettier does not read it.
    const extras = Object.fromEntries(Object.entries(carried).filter(([key]) => key !== 'reason'));
    for (const entry of relocatedOverrides(
        nativeOverrides as {
            files: string | string[];
            excludeFiles?: string | string[];
            options: Record<string, unknown>;
        }[],
        '',
        prefix,
    )) {
        const files = typeof entry.files === 'string' ? [entry.files] : entry.files;
        const excluded =
            entry.excludeFiles === undefined
                ? []
                : typeof entry.excludeFiles === 'string'
                  ? [entry.excludeFiles]
                  : entry.excludeFiles;
        overrides.push({ files, excludeFiles: excluded, options: entry.options });
    }
    const nativeDefaults = policy.tools['prettier']?.['native_defaults'] === true;
    const format = { ...(nativeDefaults ? {} : shippedFormat()), ...policy.format };
    return {
        ...prettierOptions(format),
        ...(nativeDefaults ? {} : { arrowParens: 'always', embeddedLanguageFormatting: 'off' }),
        ...extras,
        ...(pluginPaths.length === 0
            ? {}
            : { plugins: [...((extras['plugins'] as string[] | undefined) ?? []), ...pluginPaths] }),
        ...(pluginOverrides.length === 0 && overrides.length === 0
            ? {}
            : { overrides: [...pluginOverrides, ...overrides] }),
    };
}

/** A Prettier plugin a selected manifest ships: its npm name, its entry file, and the overrides its files need. */
export type PrettierPlugin = {
    name: string;
    entry: string;
    overrides: { files: string; options: Record<string, unknown> }[];
};

/**
 * Emit representable EditorConfig selectors without expanding the current file inventory.
 * @param policy the repository policy
 * @returns one override per selector with the settings EditorConfig can express
 */
export function editorconfigOverrides(policy: Policy): EditorconfigOverride[] {
    return formatEntries(policy).flatMap(({ scope, paths, format }) => {
        const options = editorconfigOptions(format);
        if (Object.keys(options).length === 0) return [];
        return expandedPaths(paths).map((pattern) => {
            if (pattern.startsWith('!') || /[\r\n]|[!+?*@]\(/u.test(pattern))
                throw new Error(
                    `EditorConfig cannot represent selector ${JSON.stringify(pattern)}. Keep this override in tools.prettier.extra.overrides or a native EditorConfig section.`,
                );
            let path = pattern;
            if (scope !== '' && !path.startsWith(`${scope}/`)) {
                if (!path.startsWith('**/') || path.slice('**/'.length).includes('/'))
                    throw new Error(
                        `EditorConfig cannot intersect selector ${JSON.stringify(pattern)} with scope ${scope}. Use a root-relative selector within that scope.`,
                    );
                path = `${literalGlob(scope)}/${path}`;
            }
            return { path: `/${path}`, options };
        });
    });
}

export type ScopedFormat = { scope: string; paths: string[]; format: Partial<FormatSettings> };

export type EditorconfigOverride = { path: string; options: Record<string, string | number | boolean> };

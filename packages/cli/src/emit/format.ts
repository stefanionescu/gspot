import { compact } from '#cli/policy/normalize.ts';
import { dirname, relative } from 'node:path';
import type { Session } from '#cli/run/types.ts';
import type { FormatSettings, Policy } from '#cli/policy/types.ts';
import type { EditorconfigOverride, ScopedFormat } from '#cli/emit/types.ts';
import { shippedFormat } from '#cli/presets/listing.ts';
import { expandedPaths } from '#cli/presets/claims.ts';

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

function prettierOptions(format: Partial<FormatSettings>): Record<string, unknown> {
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

function literalGlob(path: string): string {
    return path.replace(/[\\*?{}[\]()!+@,]/gu, '\\$&');
}

function editorconfigOptions(format: Partial<FormatSettings>): Record<string, string | number | boolean> {
    return {
        ...(format.indent_style === undefined ? {} : { indent_style: format.indent_style }),
        ...(format.indent_width === undefined ? {} : { indent_size: format.indent_width }),
        ...(format.line_ending === undefined ? {} : { end_of_line: format.line_ending }),
        ...(format.newline_at_end === undefined ? {} : { insert_final_newline: format.newline_at_end }),
    };
}

/** Generate each Prettier configuration relative to its own output path. */
export function prettierConfig(
    session: Session,
    targetPath: string,
    extra: Record<string, unknown> | undefined,
): Record<string, unknown> {
    const policy = session.policyFiles.policy;
    const prefix = relative(dirname(targetPath), '.').replaceAll('\\', '/');
    const fromConfig = (pattern: string): string => (prefix === '' ? pattern : `${prefix}/${pattern}`);
    const overrides = formatEntries(policy).map(({ scope, paths, format }) => {
        const expanded = expandedPaths(paths);
        const files = expanded.filter((path) => !path.startsWith('!')).map(fromConfig);
        const excludeFiles = expanded.filter((path) => path.startsWith('!')).map((path) => fromConfig(path.slice(1)));
        if (scope !== '') excludeFiles.push(`!${fromConfig(literalGlob(scope))}/**`);
        return { files, excludeFiles, options: prettierOptions(format) };
    });
    const { overrides: nativeOverrides = [], reason: _reason, ...extras } = extra ?? {};
    for (const entry of nativeOverrides as {
        files: string | string[];
        excludeFiles?: string | string[];
        options: Record<string, unknown>;
    }[]) {
        const files = (typeof entry.files === 'string' ? [entry.files] : entry.files).map(fromConfig);
        const excluded =
            entry.excludeFiles === undefined
                ? []
                : typeof entry.excludeFiles === 'string'
                  ? [entry.excludeFiles]
                  : entry.excludeFiles;
        overrides.push({ files, excludeFiles: excluded.map(fromConfig), options: entry.options });
    }
    const format = { ...shippedFormat(), ...policy.format } as FormatSettings;
    return {
        ...prettierOptions(format),
        arrowParens: 'always',
        embeddedLanguageFormatting: 'off',
        ...extras,
        ...(overrides.length === 0 ? {} : { overrides }),
    };
}

/** Emit representable EditorConfig selectors without expanding the current file inventory. */
export function editorconfigOverrides(session: Session): EditorconfigOverride[] {
    return formatEntries(session.policyFiles.policy).flatMap(({ scope, paths, format }) => {
        const options = editorconfigOptions(format);
        if (Object.keys(options).length === 0) return [];
        return expandedPaths(paths).map((pattern) => {
            if (pattern.startsWith('!') || /[\r\n]|[!+?*@]\(/u.test(pattern))
                throw new Error(
                    `EditorConfig cannot represent selector ${JSON.stringify(pattern)}. Keep this override in tools.prettier.extra.overrides or a native EditorConfig section.`,
                );
            let path = pattern;
            if (scope !== '' && !path.startsWith(`${scope}/`)) {
                if (!path.startsWith('**/') || path.slice(3).includes('/'))
                    throw new Error(
                        `EditorConfig cannot intersect selector ${JSON.stringify(pattern)} with scope ${scope}. Use a root-relative selector within that scope.`,
                    );
                path = `${literalGlob(scope)}/${path}`;
            }
            return { path: `/${path}`, options };
        });
    });
}

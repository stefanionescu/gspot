import { compact } from '#cli/policy/normalize.ts';
import { dirname, relative } from 'node:path';
import type { Session } from '#types/run.ts';
import type { FormatSettings, Policy } from '#types/config.ts';
import type { EditorconfigOverride, ScopedFormat } from '#types/emit.ts';
import { shippedFormat } from '#cli/presets/listing.ts';
import { expandedPaths, isInScope, pathMatcher } from '#cli/presets/claims.ts';

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
    const extras = Object.fromEntries(Object.entries(extra ?? {}).filter(([key]) => key !== 'reason'));
    const format = { ...shippedFormat(), ...policy.format } as FormatSettings;
    return {
        ...prettierOptions(format),
        arrowParens: 'always',
        embeddedLanguageFormatting: 'off',
        ...extras,
        ...(overrides.length === 0 ? {} : { overrides }),
    };
}

/** Resolve EditorConfig options for the current governed paths, including selectors its section syntax cannot express. */
export function editorconfigOverrides(session: Session): EditorconfigOverride[] {
    const entries = formatEntries(session.policyFiles.policy).map((entry) => ({
        ...entry,
        matches: pathMatcher(entry.paths),
    }));
    return session.repository.files.flatMap((file): EditorconfigOverride[] => {
        if (file.nature !== 'source' || file.path.startsWith('.gspot/')) return [];
        const format = Object.assign(
            {},
            ...entries
                .filter((entry) => isInScope(file.path, entry.scope) && entry.matches(file.path))
                .map((entry) => entry.format),
        ) as Partial<FormatSettings>;
        const options = editorconfigOptions(format);
        if (Object.keys(options).length === 0) return [];
        if (/[\r\n]/u.test(file.path))
            throw new Error(
                `EditorConfig cannot represent a path containing a line break: ${JSON.stringify(file.path)}.`,
            );
        return [{ path: `/${literalGlob(file.path)}`, options }];
    });
}

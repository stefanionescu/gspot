// File stems and directory names as identifiers: the stem without its extension, every folder on the way, Next.js segments unwrapped.
import type { Identifier } from '#cli/naming/types.ts';

const DECLARATION_SUFFIXES = ['.d.ts', '.d.mts', '.d.cts'];
const MIGRATION_DIRECTORY = /^\d{14}_/u;

function stemOf(base: string): string {
    const declaration = DECLARATION_SUFFIXES.find((suffix) => base.endsWith(suffix));
    if (declaration !== undefined) return base.slice(0, -declaration.length);
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? base : base.slice(0, dot);
}

const WRAPPERS: { open: string; close: string; category: string }[] = [
    { open: '[', close: ']', category: 'path_parameters' },
    { open: '(', close: ')', category: 'directories' },
    { open: '@', close: '', category: 'directories' },
    { open: '_', close: '', category: 'directories' },
];

function unwrapped(segment: string): { name: string; category: string } {
    const bracket = WRAPPERS.find((entry) => segment.startsWith(entry.open) && segment.endsWith(entry.close));
    if (bracket === undefined) return { name: segment, category: 'directories' };
    const inner = segment.slice(bracket.open.length, segment.length - bracket.close.length);
    return { name: inner.replace(/^\.\.\./u, ''), category: bracket.category };
}

/**
 * The file's own name as an identifier: the stem for most languages, the whole base name for a SQL migration.
 * @param path the file path
 * @param language the language preset the file belongs to
 * @returns the identifier
 */
export function fileIdentifier(path: string, language: string): Identifier {
    const base = path.slice(path.lastIndexOf('/') + 1);
    const name = language === 'sql' && base.endsWith('.sql') ? base : stemOf(base);
    const named = name.startsWith('[') ? unwrapped(name) : { name, category: 'files' };
    return {
        file: path,
        line: 1,
        column: 1,
        language,
        category: named.category,
        kind: `${language} file`,
        name: named.name,
    };
}

/**
 * Every directory on a file's path as an identifier, from the top down. Dot folders and migration folders are skipped.
 * @param path the file path
 * @param language the language preset the file belongs to
 * @returns the identifiers
 */
export function directoryIdentifiers(path: string, language: string): Identifier[] {
    const segments = path.split('/').slice(0, -1);
    return segments.flatMap((segment, index) => {
        const named = segment.startsWith('.') || MIGRATION_DIRECTORY.test(segment) ? undefined : unwrapped(segment);
        if (named === undefined || named.name === '') return [];
        const directory = segments.slice(0, index + 1).join('/');
        return [
            {
                file: path,
                line: 1,
                column: 1,
                language,
                category: named.category,
                kind: `${language} directory`,
                name: named.name,
                directory,
            },
        ];
    });
}

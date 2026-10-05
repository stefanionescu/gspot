import { posix } from 'node:path';
import { stemOf } from '#cli/platform/paths.ts';
import type { Identifier } from '#cli/types/parsers/naming.ts';
import { WRAPPERS, MIGRATION_PREFIX } from '#cli/config/checks/general/naming.ts';

function segmentName(segment: string): Pick<Identifier, 'name' | 'category'> {
    const bracket = WRAPPERS.find((entry) => segment.startsWith(entry.open) && segment.endsWith(entry.close));
    if (bracket === undefined) return { name: segment, category: 'directories' };
    const inner = segment.slice(bracket.open.length, segment.length - bracket.close.length);
    return { name: inner.replace(/^\.\.\./u, ''), category: bracket.category };
}

/**
 * The file's own name as an identifier: the stem for most languages, the whole base name for a SQL migration.
 * @param path the file path
 * @param language the language configuration the file belongs to
 * @returns the identifier
 */
export function fileIdentifier(path: string, language: string): Identifier {
    const base = posix.basename(path);
    const name = language === 'sql' && base.endsWith('.sql') ? base : stemOf(base);
    const named = name.startsWith('[') ? segmentName(name) : { name, category: 'files' };
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
 * @param language the language configuration the file belongs to
 * @returns the identifiers
 */
export function directoryIdentifiers(path: string, language: string): Identifier[] {
    const segments = path.split('/').slice(0, -1);
    return segments.flatMap((segment, index) => {
        const named = segment.startsWith('.') || MIGRATION_PREFIX.test(segment) ? undefined : segmentName(segment);
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

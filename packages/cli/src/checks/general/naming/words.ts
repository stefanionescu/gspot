import { splitByCase } from 'scule';

import {
    TIMESTAMP,
    CAMEL_WORD,
    LOWER_WORD,
    SEPARATORS,
    UPPER_WORD,
    PASCAL_WORD,
    NUMERIC_WORDS,
    MIGRATION_DIGITS,
} from '#cli/config/checks/general/naming.ts';

function isSnakeMigration(name: string): boolean {
    const stamp = name.slice(0, MIGRATION_DIGITS);
    const rest = name.slice(MIGRATION_DIGITS);
    if (!TIMESTAMP.test(stamp) || !rest.startsWith('_') || !rest.endsWith('.sql')) return false;
    const stem = rest.slice(1, -'.sql'.length);
    return stem !== '' && stem.split('_').every((word) => LOWER_WORD.test(word));
}

const CASE_TESTS = new Map<string, (name: string) => boolean>([
    ['camel', (name) => CAMEL_WORD.test(name)],
    ['pascal', (name) => PASCAL_WORD.test(name)],
    ['pascal-extension', (name) => name.includes('+') && name.split('+').every((word) => PASCAL_WORD.test(word))],
    ['kebab', (name) => name !== '' && name.split('-').every((word) => LOWER_WORD.test(word))],
    ['snake', (name) => name !== '' && name.split('_').every((word) => LOWER_WORD.test(word))],
    ['upper-snake', (name) => name !== '' && name.split('_').every((word) => UPPER_WORD.test(word))],
    ['timestamp-snake', isSnakeMigration],
]);

/** The names accepted by case validation, in their display order. */
export const CASE_NAMES = [...CASE_TESTS.keys()];

/**
 * True when the name has the case.
 * @param name the full migration filename, or an ordinary name with digits removed.
 * @param caseName one of camel, pascal, pascal-extension, kebab, snake, upper-snake, timestamp-snake.
 * @returns whether it matches; an unknown case name never matches.
 */
export function hasCase(name: string, caseName: string): boolean {
    return CASE_TESTS.get(caseName)?.(name) ?? false;
}

/**
 * The parts of an identifier, lowercased. `HTMLParser` gives `html`, `parser`; `user_id` gives `user`, `id`; `v2` gives `v`, `2`; `base64` stays one word.
 * @param name the identifier
 * @returns the parts
 */
export function splitParts(name: string): string[] {
    return name
        .split(SEPARATORS)
        .filter((segment) => segment !== '')
        .flatMap((segment) => splitByCase(segment))
        .flatMap((part) =>
            NUMERIC_WORDS.has(part.toLowerCase()) ? [part] : part.split(/(?<=\D)(?=\d)|(?<=\d)(?=\D)/u),
        )
        .map((part) => part.toLowerCase())
        .filter((part) => part !== '');
}

/**
 * The first part that appears twice, if any.
 * @param parts the parts
 * @returns the repeated part
 */
export function repeatedPart(parts: string[]): string | undefined {
    const seen = new Set<string>();
    for (const part of parts) {
        if (seen.has(part)) return part;
        seen.add(part);
    }
    return undefined;
}

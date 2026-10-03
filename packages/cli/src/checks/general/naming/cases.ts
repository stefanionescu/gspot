import {
    TIMESTAMP,
    CAMEL_WORD,
    LOWER_WORD,
    UPPER_WORD,
    PASCAL_WORD,
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
    ['pascal-plus', (name) => name.includes('+') && name.split('+').every((word) => PASCAL_WORD.test(word))],
    ['kebab', (name) => name !== '' && name.split('-').every((word) => LOWER_WORD.test(word))],
    ['snake', (name) => name !== '' && name.split('_').every((word) => LOWER_WORD.test(word))],
    ['upper-snake', (name) => name !== '' && name.split('_').every((word) => UPPER_WORD.test(word))],
    ['snake-migration', isSnakeMigration],
]);

/** The names accepted by case validation, in their display order. */
export const CASE_NAMES = [...CASE_TESTS.keys()];

/**
 * True when the name has the case.
 * @param name the full migration filename, or an ordinary name with digits removed.
 * @param caseName one of camel, pascal, pascal-plus, kebab, snake, upper-snake, snake-migration.
 * @returns whether it matches; an unknown case name never matches.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Name validation looks up a case checker by name in two places, and an unknown case never matches.
export function hasCase(name: string, caseName: string): boolean {
    return CASE_TESTS.get(caseName)?.(name) ?? false;
}

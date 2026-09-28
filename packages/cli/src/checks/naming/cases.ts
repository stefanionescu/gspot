import {
    MIGRATION_TIMESTAMP_DIGITS,
    CAMEL_WORD,
    LOWER_WORD,
    PASCAL_WORD,
    TIMESTAMP,
    UPPER_WORD,
} from '#cli/constants/checks/naming.ts';

function isJoined(name: string, separator: string, pattern: RegExp): boolean {
    return name !== '' && name.split(separator).every((word) => pattern.test(word));
}

function isSnakeMigration(name: string): boolean {
    const stamp = name.slice(0, MIGRATION_TIMESTAMP_DIGITS);
    const rest = name.slice(MIGRATION_TIMESTAMP_DIGITS);
    if (!TIMESTAMP.test(stamp) || !rest.startsWith('_') || !rest.endsWith('.sql')) return false;
    return isJoined(rest.slice(1, -'.sql'.length), '_', LOWER_WORD);
}

const CHECKS = new Map<string, (name: string) => boolean>([
    ['camel', (name) => CAMEL_WORD.test(name)],
    ['pascal', (name) => PASCAL_WORD.test(name)],
    ['pascal-plus', (name) => name.includes('+') && isJoined(name, '+', PASCAL_WORD)],
    ['kebab', (name) => isJoined(name, '-', LOWER_WORD)],
    ['snake', (name) => isJoined(name, '_', LOWER_WORD)],
    ['upper-snake', (name) => isJoined(name, '_', UPPER_WORD)],
    ['snake-migration', isSnakeMigration],
]);

/** The names accepted by case validation, in their display order. */
export const CASE_NAMES = [...CHECKS.keys()];

/**
 * True when the name has the case.
 * @param name the full migration filename, or an ordinary name with digits removed.
 * @param caseName one of camel, pascal, pascal-plus, kebab, snake, upper-snake, snake-migration.
 * @returns whether it matches; an unknown case name never matches.
 */
export function hasCase(name: string, caseName: string): boolean {
    return CHECKS.get(caseName)?.(name) ?? false;
}

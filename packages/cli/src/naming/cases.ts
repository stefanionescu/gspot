// Does a name have the case its category asks for? Digits are left out on purpose: the digit ban reports them.
import { MIGRATION_TIMESTAMP_DIGITS } from '#cli/naming/cases-definitions.ts';

const LOWER_WORD = /^[a-z]+$/u;
const CAMEL_WORD = /^[a-z][A-Za-z]*$/u;
const PASCAL_WORD = /^[A-Z][A-Za-z]*$/u;
const UPPER_WORD = /^[A-Z]+$/u;
const TIMESTAMP = /^\d+$/u;

function isJoined(name: string, separator: string, isWord: (word: string) => boolean): boolean {
    return name !== '' && name.split(separator).every((word) => isWord(word));
}

function isSnakeMigration(name: string): boolean {
    const stamp = name.slice(0, MIGRATION_TIMESTAMP_DIGITS);
    const rest = name.slice(MIGRATION_TIMESTAMP_DIGITS);
    if (!TIMESTAMP.test(stamp) || !rest.startsWith('_') || !rest.endsWith('.sql')) return false;
    return isJoined(rest.slice(1, -'.sql'.length), '_', (word) => LOWER_WORD.test(word));
}

const CHECKS: Record<string, (name: string) => boolean> = {
    camel: (name) => CAMEL_WORD.test(name),
    pascal: (name) => PASCAL_WORD.test(name),
    'pascal-plus': (name) => name.includes('+') && isJoined(name, '+', (word) => PASCAL_WORD.test(word)),
    kebab: (name) => isJoined(name, '-', (word) => LOWER_WORD.test(word)),
    snake: (name) => isJoined(name, '_', (word) => LOWER_WORD.test(word)),
    'upper-snake': (name) => isJoined(name, '_', (word) => UPPER_WORD.test(word)),
    'snake-migration': isSnakeMigration,
};

/**
 * True when the name has the case.
 * @param name the name, digits removed
 * @param caseName one of camel, pascal, pascal-plus, kebab, snake, upper-snake, snake-migration
 * @returns whether it matches; an unknown case name never matches
 */
export function hasCase(name: string, caseName: string): boolean {
    return CHECKS[caseName]?.(name) ?? false;
}

/**
 * True when a case name is one the policy knows.
 * @param caseName the name
 * @returns whether hasCase can judge it
 */
export function isKnownCase(caseName: string): boolean {
    return Object.hasOwn(CHECKS, caseName);
}

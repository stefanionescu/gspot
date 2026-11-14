import type { VersionCeiling } from '../types/plugin.ts';

import {
    VERSION_SIZE,
    VERSION_NUMBER,
    VERSION_SPACES,
    VERSION_PATTERN,
    VERSION_WILDCARD,
    VERSION_OPERATORS,
    UNBOUNDED_VERSIONS,
    VERSION_ALTERNATIVES,
} from '../config/plugin.ts';

function bumpVersion(numbers: number[], kind: string): number[] {
    let position = numbers.length - 1;
    if (kind === 'caret') {
        const nonZero = numbers.findIndex((value) => value > 0);
        position = nonZero === -1 ? numbers.length - 1 : nonZero;
    } else if (kind === 'tilde') position = Math.min(1, position);
    return numbers.slice(0, position + 1).map((value, index) => (index === position ? value + 1 : value));
}

function buildCeiling(numbers: number[], kind: string | undefined): VersionCeiling | null {
    if (kind === 'unbounded' || kind === undefined || numbers.length === 0) return null;
    if (kind === 'upto' || kind === 'below') return { version: numbers, isInclusive: kind === 'upto' };
    const isExact = kind === 'exact' && numbers.length === VERSION_SIZE;
    return isExact
        ? { version: numbers, isInclusive: true }
        : { version: bumpVersion(numbers, kind), isInclusive: false };
}

function listRangeComparators(range: string): string[][] {
    return range.split(VERSION_ALTERNATIVES).map((alternative) => alternative.trim().split(VERSION_SPACES));
}

function parseComparator(comparator: string): { operator: string; fields: string[] } | undefined {
    const groups = VERSION_PATTERN.exec(comparator)?.groups;
    if (groups === undefined) return undefined;
    return { operator: groups['operator'] ?? '', fields: (groups['number'] ?? '').split('.') };
}

function getCeiling(comparator: string): VersionCeiling | null | undefined {
    const parsed = parseComparator(comparator);
    if (parsed === undefined) return undefined;
    const { operator, fields } = parsed;
    if (fields.length > VERSION_SIZE || !fields.every((field) => VERSION_NUMBER.test(field))) return undefined;
    const numbers = fields.flatMap((field) => (VERSION_WILDCARD.test(field) ? [] : [Number(field)]));
    return buildCeiling(numbers, VERSION_OPERATORS.get(operator));
}

function compareVersions(left: readonly number[], right: readonly number[]): number {
    const differences = right.map((value, position) => (left[position] ?? 0) - value);
    return differences.find((difference) => difference !== 0) ?? 0;
}

export function allowsVersion(range: string, minimum: readonly number[]): boolean | undefined {
    const ceilings = listRangeComparators(range).map((comparators) =>
        comparators.map((comparator) => (UNBOUNDED_VERSIONS.has(comparator) ? null : getCeiling(comparator))),
    );
    if (ceilings.flat().includes(undefined)) return undefined;
    return ceilings.some((comparators) =>
        comparators.every((ceiling) => {
            const difference = ceiling ? compareVersions(ceiling.version, minimum) : 1;
            return difference > 0 || (difference === 0 && ceiling?.isInclusive === true);
        }),
    );
}

/**
Check whether every alternative of a range has a lower bound at or above the minimum. A comparator that does not have
the form of a version is skipped.
*/
export function requiresVersion(range: string, minimum: readonly number[]): boolean {
    const lowerBounds = listRangeComparators(range).map((comparators) =>
        comparators.flatMap((comparator) => {
            const parsed = parseComparator(comparator);
            const isLowerBound = parsed !== undefined && !parsed.operator.startsWith('<');
            return isLowerBound
                ? [parsed.fields.map((field) => (VERSION_WILDCARD.test(field) ? 0 : Number(field)))]
                : [];
        }),
    );
    return lowerBounds.every((versions) => versions.some((version) => compareVersions(version, minimum) >= 0));
}

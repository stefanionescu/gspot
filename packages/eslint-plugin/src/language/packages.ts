import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { TSESLint } from '@typescript-eslint/utils';

import {
    DEPENDENCY_FIELDS,
    PACKAGE_MANIFEST,
    REPOSITORY_MARKER,
    UNBOUNDED_VERSIONS,
    VERSION_ALTERNATIVES,
    VERSION_NUMBER,
    VERSION_OPERATORS,
    VERSION_PATTERN,
    VERSION_SIZE,
    VERSION_SPACES,
    VERSION_WILDCARD,
} from '../config/packages.ts';
import type { FileContext, PackageFacts, VersionCeiling } from '../types/plugin.ts';
import { getRootFolder, listImportedModules } from './modules.ts';

const manifestCache = new WeakMap<TSESLint.SourceCode, PackageFacts>();

function listManifestFolders(context: FileContext): string[] {
    const root = getRootFolder(context);
    let folder = dirname(context.filename);
    const folders = [folder];
    while (folder !== root && dirname(folder) !== folder && !existsSync(join(folder, REPOSITORY_MARKER))) {
        folder = dirname(folder);
        folders.push(folder);
    }
    return folders;
}

function readManifestDependencies(path: string): Array<[string, string]> {
    const manifest = readManifest(path);
    const fields = DEPENDENCY_FIELDS.map((field) => manifest?.[field]);
    return fields.flatMap((value) =>
        value !== null && typeof value === 'object'
            ? Object.entries(value).map(([name, range]): [string, string] => [name, String(range)])
            : [],
    );
}

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

/**
Read a package.json file. Return undefined when it is not valid JSON or does not hold an object.
*/
export function readManifest(path: string): Readonly<Record<string, unknown>> | undefined {
    try {
        const manifest: unknown = JSON.parse(readFileSync(path, 'utf8'));
        return manifest !== null && typeof manifest === 'object'
            ? (manifest as Readonly<Record<string, unknown>>)
            : undefined;
    } catch (error) {
        if (error instanceof SyntaxError) return undefined;
        throw error;
    }
}

/**
List the package.json files that exist between the linted file and the root, nearest first.
*/
export function listManifestPaths(context: FileContext): string[] {
    return listManifestFolders(context)
        .map((folder) => join(folder, PACKAGE_MANIFEST))
        .filter((path) => existsSync(path));
}

export function readPackageFacts(context: FileContext): PackageFacts {
    const cached = manifestCache.get(context.sourceCode);
    if (cached !== undefined) return cached;
    const manifests = listManifestPaths(context);
    const dependencies = new Map(manifests.flatMap((path) => readManifestDependencies(path)).toReversed());
    const facts = { dependencies, manifests: manifests.length };
    manifestCache.set(context.sourceCode, facts);
    return facts;
}

export function isModuleUsed(
    context: FileContext,
    modules: readonly string[],
    dependencies: readonly string[] = modules,
): boolean {
    const imported = listImportedModules(context.sourceCode);
    if (modules.some((module) => imported.has(module))) return true;
    const listed = readPackageFacts(context).dependencies;
    return dependencies.some((dependency) => listed.has(dependency));
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

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

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
    VUE_THREE,
} from '../config/libraries.ts';
import { PLUGIN_PREFIX } from '../config/plugin.ts';
import type { PackageFacts, VersionCeiling } from '../types/libraries.ts';
import type { FileContext } from '../types/plugin.ts';

const manifestCache = new WeakMap<TSESLint.SourceCode, PackageFacts>();

const importCache = new WeakMap<TSESLint.SourceCode, ReadonlySet<string>>();

function readManifestDependencies(path: string): Array<[string, string]> {
    try {
        const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown> | null;
        const fields = DEPENDENCY_FIELDS.map((field) => manifest?.[field]);
        return fields.flatMap((value) =>
            value !== null && typeof value === 'object'
                ? Object.entries(value).map(([name, range]): [string, string] => [name, String(range)])
                : [],
        );
    } catch (error) {
        if (error instanceof SyntaxError) return [];
        throw error;
    }
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

function getCeiling(comparator: string): VersionCeiling | null | undefined {
    const groups = VERSION_PATTERN.exec(comparator)?.groups;
    const fields = (groups?.['number'] ?? '').split('.');
    const isVersion = fields.length <= VERSION_SIZE && fields.every((field) => VERSION_NUMBER.test(field));
    if (groups === undefined || !isVersion) return undefined;
    const numbers = fields.flatMap((field) => (VERSION_WILDCARD.test(field) ? [] : [Number(field)]));
    return buildCeiling(numbers, VERSION_OPERATORS.get(groups['operator'] ?? ''));
}

export function listManifestFolders(context: FileContext): string[] {
    const root = (context.settings[PLUGIN_PREFIX] as { root?: string } | undefined)?.root;
    let folder = dirname(context.filename);
    const folders = [folder];
    while (folder !== root && dirname(folder) !== folder && !existsSync(join(folder, REPOSITORY_MARKER))) {
        folder = dirname(folder);
        folders.push(folder);
    }
    return folders;
}

export function readPackageFacts(context: FileContext): PackageFacts {
    const cached = manifestCache.get(context.sourceCode);
    if (cached !== undefined) return cached;
    const manifests = listManifestFolders(context)
        .map((folder) => join(folder, PACKAGE_MANIFEST))
        .filter((path) => existsSync(path));
    const dependencies = new Map(manifests.flatMap((path) => readManifestDependencies(path)).toReversed());
    const facts = { dependencies, manifests: manifests.length };
    manifestCache.set(context.sourceCode, facts);
    return facts;
}

export function getRequiredModule(node: TSESTree.Node): string | undefined {
    let value = node;
    while (value.type === AST_NODE_TYPES.MemberExpression) value = value.object;
    const call = value.type === AST_NODE_TYPES.CallExpression ? value : undefined;
    if (call?.callee.type !== AST_NODE_TYPES.Identifier || call.callee.name !== 'require') return undefined;
    const [module] = call.arguments.map((argument) => ASTUtils.getStringIfConstant(argument));
    return module ?? undefined;
}

export function listImportedModules(source: TSESLint.SourceCode): ReadonlySet<string> {
    const cached = importCache.get(source);
    if (cached !== undefined) return cached;
    const globalScope = source.getScope(source.ast);
    const references = [...globalScope.through, ...(globalScope.set.get('require')?.references ?? [])];
    const statements = source.ast.body.flatMap((statement): TSESTree.Node[] =>
        'body' in statement && Array.isArray(statement.body) ? statement.body : [statement],
    );
    const modules = new Set([
        ...statements.flatMap((statement) =>
            statement.type === AST_NODE_TYPES.ImportDeclaration ? [statement.source.value] : [],
        ),
        ...references.flatMap((reference) => getRequiredModule(reference.identifier.parent) ?? []),
    ]);
    importCache.set(source, modules);
    return modules;
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

export function compareVersions(left: readonly number[], right: readonly number[]): number {
    const differences = right.map((value, position) => (left[position] ?? 0) - value);
    return differences.find((difference) => difference !== 0) ?? 0;
}

export function allowsVersion(range: string, minimum: readonly number[]): boolean | undefined {
    const alternatives = range
        .split(VERSION_ALTERNATIVES)
        .map((alternative) => alternative.trim().split(VERSION_SPACES));
    const ceilings = alternatives.map((comparators) =>
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
Check whether the package.json files above the file allow Vue 3 or newer. Count a Vue range that does not have the
form of a version range as Vue 3.
*/
export function isVueThreeUsed(context: FileContext): boolean {
    const range = readPackageFacts(context).dependencies.get('vue');
    if (range === undefined) return false;
    return allowsVersion(range, VUE_THREE) !== false;
}

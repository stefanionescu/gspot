import { join, dirname } from 'node:path';
import { PLUGIN_PREFIX } from './config/plugin.ts';
import { existsSync, readFileSync } from 'node:fs';
import type { FileContext, PackageFacts, VersionCeiling } from './types/rules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    VUE_THREE,
    VERSION_SIZE,
    VERSION_NUMBER,
    VERSION_SPACES,
    VERSION_PATTERN,
    VERSION_WILDCARD,
    PACKAGE_MANIFEST,
    VERSION_OPERATORS,
    DEPENDENCY_FIELDS,
    REPOSITORY_MARKER,
    UNBOUNDED_VERSIONS,
    VERSION_ALTERNATIVES,
} from './config/packages.ts';

const manifestCache = new WeakMap<TSESLint.SourceCode, PackageFacts>();

const importCache = new WeakMap<TSESLint.SourceCode, ReadonlySet<string>>();

function readManifestDependencies(path: string): [string, string][] {
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const fields = DEPENDENCY_FIELDS.map((field) => manifest[field]);
    return fields.flatMap((value) =>
        value !== null && typeof value === 'object'
            ? Object.entries(value).map(([name, range]): [string, string] => [name, String(range)])
            : [],
    );
}

function listManifestFolders(context: FileContext): string[] {
    const root = (context.settings[PLUGIN_PREFIX] as { root?: string } | undefined)?.root;
    let folder = dirname(context.filename);
    const folders = [folder];
    while (folder !== root && dirname(folder) !== folder && !existsSync(join(folder, REPOSITORY_MARKER))) {
        folder = dirname(folder);
        folders.push(folder);
    }
    return folders;
}

/**
Read the package.json files from the folder of the file up to the repository root. Count them, and map each package
name they list to its version range, which the nearest file sets.

@param context the rule context of the file.
*/
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

/**
Read the module that a `require` call names, through the members read from its result.

@param node the call or a member of its result.
*/
export function readRequiredModule(node: TSESTree.Node): string | undefined {
    let value = node;
    while (value.type === AST_NODE_TYPES.MemberExpression) value = value.object;
    const call = value.type === AST_NODE_TYPES.CallExpression ? value : undefined;
    if (call?.callee.type !== AST_NODE_TYPES.Identifier || call.callee.name !== 'require') return undefined;
    const [module] = call.arguments.map((argument) => ASTUtils.getStringIfConstant(argument));
    return module ?? undefined;
}

/**
List the modules that a file imports or requires.

@param source the file.
*/
export function listImportedModules(source: TSESLint.SourceCode): ReadonlySet<string> {
    const cached = importCache.get(source);
    if (cached !== undefined) return cached;
    const globalScope = source.getScope(source.ast);
    const references = [...globalScope.through, ...(globalScope.set.get('require')?.references ?? [])];
    const modules = new Set([
        ...source.ast.body.flatMap((statement) =>
            statement.type === AST_NODE_TYPES.ImportDeclaration ? [statement.source.value] : [],
        ),
        ...references.flatMap((reference) => readRequiredModule(reference.identifier.parent) ?? []),
    ]);
    importCache.set(source, modules);
    return modules;
}

/**
Check whether the file imports one of the modules, or a package.json above it depends on one of the packages.

@param context the rule context of the file.
@param modules the module names to find in imports.
@param dependencies the package names to find in the manifests.
*/
export function usesModule(
    context: FileContext,
    modules: readonly string[],
    dependencies: readonly string[] = modules,
): boolean {
    const imported = listImportedModules(context.sourceCode);
    if (modules.some((module) => imported.has(module))) return true;
    const listed = readPackageFacts(context).dependencies;
    return dependencies.some((dependency) => listed.has(dependency));
}

function compareVersions(left: readonly number[], right: readonly number[]): number {
    const index = left.findIndex((value, position) => value !== (right[position] ?? 0));
    return index === -1 ? 0 : (left[index] ?? 0) - (right[index] ?? 0);
}

function bumpVersion(numbers: number[], kind: string): number[] {
    let position = numbers.length - 1;
    if (kind === 'caret')
        position = Math.max(
            numbers.findIndex((value) => value > 0),
            0,
        );
    if (kind === 'tilde') position = Math.min(1, position);
    return [...numbers.slice(0, position), (numbers[position] ?? 0) + 1];
}

function buildCeiling(numbers: number[], kind: string | undefined): VersionCeiling | null {
    if (kind === 'unbounded' || kind === undefined || numbers.length === 0) return null;
    if (kind === 'upto' || kind === 'below') return { version: numbers, isInclusive: kind === 'upto' };
    const isExact = kind === 'exact' && numbers.length === VERSION_SIZE;
    return isExact
        ? { version: numbers, isInclusive: true }
        : { version: bumpVersion(numbers, kind), isInclusive: false };
}

function readCeiling(comparator: string): VersionCeiling | null | undefined {
    const groups = VERSION_PATTERN.exec(comparator)?.groups;
    const fields = (groups?.['number'] ?? '').split('.');
    const isVersion = fields.length <= VERSION_SIZE && fields.every((field) => VERSION_NUMBER.test(field));
    if (groups === undefined || !isVersion) return undefined;
    const numbers = fields.flatMap((field) => (VERSION_WILDCARD.test(field) ? [] : [Number(field)]));
    return buildCeiling(numbers, VERSION_OPERATORS.get(groups['operator'] ?? ''));
}

/**
Check whether a package.json version range allows a version at or above a minimum.

@param range the range from package.json.
@param minimum the lowest version, as major, minor, and patch numbers.
@returns undefined for a range that does not have the form of a version range.
*/
export function allowsVersion(range: string, minimum: readonly number[]): boolean | undefined {
    const alternatives = range
        .split(VERSION_ALTERNATIVES)
        .map((alternative) => alternative.trim().split(VERSION_SPACES));
    const ceilings = alternatives.map((comparators) =>
        comparators.map((comparator) => (UNBOUNDED_VERSIONS.has(comparator) ? null : readCeiling(comparator))),
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
Check whether every version that a package.json range allows sits at or above a minimum. A range without a lower bound,
or one that does not have the form of a version range, does not.

@param range the range from package.json.
@param minimum the lowest version, as major, minor, and patch numbers.
*/
export function requiresVersion(range: string, minimum: readonly number[]): boolean {
    const alternatives = range
        .split(VERSION_ALTERNATIVES)
        .map((alternative) => alternative.trim().split(VERSION_SPACES));
    const lowerBounds = alternatives.map((comparators) =>
        comparators.flatMap((comparator) => {
            const groups = VERSION_PATTERN.exec(comparator)?.groups;
            const isLowerBound = groups !== undefined && !(groups['operator'] ?? '').startsWith('<');
            const fields = (groups?.['number'] ?? '').split('.');
            return isLowerBound ? [fields.map((field) => (VERSION_WILDCARD.test(field) ? 0 : Number(field)))] : [];
        }),
    );
    return lowerBounds.every((versions) => versions.some((version) => compareVersions(version, minimum) >= 0));
}

/**
Check whether the package.json files above the file allow Vue 3 or newer. Count a Vue range that does not have the
form of a version range as Vue 3.

@param context the rule context of the file.
*/
export function usesVueThree(context: FileContext): boolean {
    const range = readPackageFacts(context).dependencies.get('vue');
    if (range === undefined) return false;
    return allowsVersion(range, VUE_THREE) !== false;
}

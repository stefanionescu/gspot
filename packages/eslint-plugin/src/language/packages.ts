import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { TSESLint } from '@typescript-eslint/utils';

import { DEPENDENCY_FIELDS, PACKAGE_MANIFEST, REPOSITORY_MARKER } from '../config/plugin.ts';
import type { FileContext, PackageFacts } from '../types/plugin.ts';
import { listImportedModules } from './modules.ts';
import { getRootFolder } from './paths.ts';

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

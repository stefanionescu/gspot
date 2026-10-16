// Reads repository dependency files and selects project dependencies.

import { posix } from 'node:path';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { type ReadCache } from '#cli/types/system/files.ts';
import { HOOK_PACKAGES } from '#cli/config/repository/hooks.ts';
import { isInstalledToolPath } from '#cli/repository/classify.ts';
import { readText, readCachedText } from '#cli/system/files/reads.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { packageJsonSchema, selectDependencyFileParser } from '#cli/parsers/dependency-files.ts';
import { type PackageJson, type DependencyMap, type DependencyFile } from '#cli/types/parsers/dependency-files.ts';

// Keep each parser failure tied to the dependency file that caused it.
async function readDependencyFile(reads: ReadCache, file: TrackedFile): Promise<DependencyFile | undefined> {
    try {
        const parse = selectDependencyFileParser(file.path);
        if (parse === undefined) return undefined;
        const text = readCachedText(reads, file.path);
        if (text === undefined) throw new Error(`Manifest is missing: ${file.path}`);
        return await parse(file.path, text);
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot inspect manifest ${file.path}: ${detail}`, { cause: error });
    }
}

/**
 * Read supported project manifests for dependency and runtime detection.
 * @param reads the run's cached source reads.
 * @param files the tracked files.
 * @returns one project manifest per supported source file.
 */
export async function readDependencyFiles(reads: ReadCache, files: TrackedFile[]): Promise<DependencyFile[]> {
    const dependencies: DependencyFile[] = [];
    for (const file of files.filter((file) => file.kind === 'source' && !isInstalledToolPath(file.path))) {
        const dependencyFile = await readDependencyFile(reads, file);
        if (dependencyFile !== undefined) dependencies.push(dependencyFile);
    }
    return dependencies;
}

/**
 * Read and validate the package fields used by repository and check consumers.
 * @param root the repository root.
 * @param path the repository-relative package.json path.
 * @returns the validated package fields, or undefined when the file does not exist.
 */
export function readPackageJson(root: string, path: string): PackageJson | undefined {
    const text = readText(root, path);
    if (text === undefined) return undefined;
    return parseJsonFile(path, text, packageJsonSchema);
}

/**
 * True when an npm manifest holds only declared npm tools or recognized Git hook managers.
 * @param dependencyFile the parsed project manifest.
 * @param npmNames declared npm installer packages.
 * @returns whether it holds tooling only.
 */
export function isToolOnlyPackage(dependencyFile: DependencyFile, npmNames: ReadonlySet<string>): boolean {
    if (dependencyFile.kind !== 'package.json') return false;
    const names = Object.keys(dependencyFile.installed);
    if (names.length === 0) return false;
    return names.every((name) => npmNames.has(name) || HOOK_PACKAGES.has(name));
}

/**
 * Get dependencies from the nearest declared npm project that contains a scope.
 * @param dependencyFiles validated source project manifests.
 * @param scope the repository-relative project scope.
 * @returns declared dependencies without borrowing from children or siblings.
 */
export function getProjectDependencies(dependencyFiles: DependencyFile[], scope: string): DependencyMap {
    const owner = dependencyFiles
        .filter((manifest) => {
            if (manifest.kind !== 'package.json') return false;
            const folder = manifest.path === PACKAGE_JSON ? '' : posix.dirname(manifest.path);
            return folder === '' || scope === folder || scope.startsWith(`${folder}/`);
        })
        .toSorted((first, second) => second.path.length - first.path.length)[0];
    if (owner === undefined) return {};
    return owner.dependencies;
}

// Reads repository dependency files and selects project dependencies.

import { posix } from 'node:path';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { type ReadCache } from '#cli/types/system/files.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { HOOK_PACKAGES } from '#cli/config/repository/hooks.ts';
import { listNpmToolNames } from '#cli/configurations/tools.ts';
import { isInstalledToolPath } from '#cli/repository/classify.ts';
import { readText, readCachedText } from '#cli/system/files/reads.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { type PackageJson, type DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import { packageJsonSchema, selectDependencyFileParser } from '#cli/parsers/dependency-files.ts';

// Keep each parser failure tied to the dependency file that caused it.
async function readDependencyFile(reads: ReadCache, file: TrackedFile): Promise<DependencyFile | undefined> {
    try {
        const parse = selectDependencyFileParser(file.path);
        if (parse === undefined) return undefined;
        const text = readCachedText(reads, file.path);
        if (text === undefined) throw new Error(`The dependency file is missing: ${file.path}`);
        return await parse(file.path, text);
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read the dependency file ${file.path}: ${detail}`, { cause: error });
    }
}

/**
 * Read the supported dependency files for dependency and runtime detection.
 *
 * @param reads the run cache.
 * @param files the tracked inventory.
 * @returns one dependency file per supported source file.
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
 * Read and validate the package.json fields that gspot uses.
 *
 * @param repositoryRoot the base folder of the path.
 * @param path the repository-relative package.json.
 * @returns the validated package fields, or undefined when the file does not exist.
 */
export function readPackageJson(repositoryRoot: string, path: string): PackageJson | undefined {
    const text = readText(repositoryRoot, path);
    if (text === undefined) return undefined;
    return parseJsonFile(path, text, packageJsonSchema);
}

/**
 * List the tool-only packages: each package.json that holds only declared npm tools and Git hook packages.
 *
 * @param dependencyFiles the parsed files.
 * @param manifests the configurations that declare the npm tools.
 * @returns the paths of the tool-only packages.
 */
export function listToolOnlyPackages(dependencyFiles: DependencyFile[], manifests: Iterable<Manifest>): Set<string> {
    const npmNames = listNpmToolNames(manifests);
    return new Set(
        dependencyFiles
            .filter((dependencyFile) => {
                if (dependencyFile.kind !== 'package.json') return false;
                const names = Object.keys(dependencyFile.installed);
                return names.length > 0 && names.every((name) => npmNames.has(name) || HOOK_PACKAGES.has(name));
            })
            .map((dependencyFile) => dependencyFile.path),
    );
}

/**
 * List the dependency names of the nearest declared npm project that contains a scope.
 *
 * @param dependencyFiles the validated files.
 * @param scope the repository-relative project folder.
 * @returns the declared dependency names. Child and sibling projects keep their own.
 */
export function listProjectDependencyNames(dependencyFiles: DependencyFile[], scope: string): string[] {
    const owner = dependencyFiles
        .filter((dependencyFile) => {
            if (dependencyFile.kind !== PACKAGE_JSON) return false;
            const folder = dependencyFile.path === PACKAGE_JSON ? '' : posix.dirname(dependencyFile.path);
            return folder === '' || scope === folder || scope.startsWith(`${folder}/`);
        })
        .toSorted((first, second) => second.path.length - first.path.length)[0];
    return owner === undefined ? [] : Object.keys(owner.dependencies);
}

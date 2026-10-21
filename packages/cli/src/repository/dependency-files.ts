// Reads repository dependency files and selects project dependencies.
import { posix } from 'node:path';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { listEnclosingFolders } from '#cli/system/paths.ts';
import { type ReadCache } from '#cli/types/system/files.ts';
import { HOOK_PACKAGES } from '#cli/config/repository/hooks.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { DEPENDENCY_SECTIONS } from '#cli/config/parsers/lockfiles.ts';
import { isInToolFolder } from '#cli/repository/files/tool-folders.ts';
import { listNpmToolNames } from '#cli/configurations/declared-tools.ts';
import { PARSERS, parseRequirements } from '#cli/parsers/dependencies.ts';
import { PACKAGE_JSON, REQUIREMENTS_FILE } from '#cli/config/parsers/dependencies.ts';
import { packageJsonSchema } from '#cli/schemas/parsers/dependencies/package-json.ts';
import { findText, findCachedText, readCachedText } from '#cli/system/files/reads.ts';
import { type PackageJson, type DependencyFile } from '#cli/types/parsers/dependencies.ts';

// Keep each parser failure tied to the dependency file that caused it.
async function readDependencyFile(reads: ReadCache, file: TrackedFile): Promise<DependencyFile | undefined> {
    const parse = REQUIREMENTS_FILE.test(file.path) ? parseRequirements : PARSERS[posix.basename(file.path)];
    if (parse === undefined) return undefined;
    const text = readCachedText(reads, file.path);
    return await parse(file.path, text);
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
    for (const file of files.filter((file) => file.kind === 'source' && !isInToolFolder(file.path))) {
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
    const text = findText(repositoryRoot, path);
    if (text === undefined) return undefined;
    return parseJsonFile(path, text, packageJsonSchema);
}

/**
 * Read the package.json fields used by repository checks through the run cache.
 *
 * @param reads the cache rooted at the repository.
 * @param path the repository-relative package.json path.
 * @returns the validated fields, or undefined when the file does not exist.
 */
export function readCachedPackageJson(reads: ReadCache, path: string): PackageJson | undefined {
    const text = findCachedText(reads, path);
    return text === undefined ? undefined : parseJsonFile(path, text, packageJsonSchema);
}

/**
 * Read the dependency specifiers declared for installation.
 *
 * @param reads the cache rooted at the repository.
 * @param path the repository-relative package.json path.
 * @returns the specifiers by name, or undefined when the file does not exist.
 */
export function readDeclaredSpecifiers(reads: ReadCache, path: string): Map<string, string> | undefined {
    const fields = readCachedPackageJson(reads, path);
    if (fields === undefined) return undefined;
    return new Map(
        DEPENDENCY_SECTIONS.flatMap((section) => {
            const dependencies = fields[section];
            return dependencies === undefined ? [] : Object.entries(dependencies);
        }),
    );
}

/**
 * List the tool-only packages: each package.json that holds only declared npm tools and Git hook packages.
 *
 * @param dependencyFiles the parsed files.
 * @param configurations the configurations that declare the npm tools.
 * @returns the paths of the tool-only packages.
 */
export function listToolOnlyPackages(
    dependencyFiles: DependencyFile[],
    configurations: Iterable<Configuration>,
): Set<string> {
    const npmNames = listNpmToolNames(configurations);
    return new Set(
        dependencyFiles
            .filter((dependencyFile) => {
                if (dependencyFile.kind !== PACKAGE_JSON) return false;
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
    const projects = new Map(
        dependencyFiles.filter((file) => file.kind === PACKAGE_JSON).map((file) => [file.path, file]),
    );
    const owner = listEnclosingFolders(scope)
        .map((folder) => projects.get(posix.join(folder, PACKAGE_JSON)))
        .find((file) => file !== undefined);
    return owner === undefined ? [] : Object.keys(owner.dependencies);
}

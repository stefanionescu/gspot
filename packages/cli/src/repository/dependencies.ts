import { posix } from 'node:path';
import { find, read } from '#cli/system/files/reads.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { listNpmToolNames } from '#cli/manifests/tools.ts';
import { type ReadCache } from '#cli/types/system/files.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { REQUIREMENTS_FILE } from '#cli/config/files/names.ts';
import { type TrackedFile } from '#cli/types/repository/files.ts';
import { HOOK_PACKAGES } from '#cli/config/repository/dependencies.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { DEPENDENCY_SECTIONS } from '#cli/config/parsers/projects/lockfiles.ts';
import { isInInstalledFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import { packageJsonSchema } from '#cli/schemas/parsers/projects/dependencies.ts';
import { parseRequirements, DEPENDENCY_FILE_PARSERS } from '#cli/parsers/projects/dependencies.ts';
import { type PackageJson, type DependencyFile } from '#cli/types/parsers/projects/dependencies.ts';

async function readDependencyFile(reads: ReadCache, file: TrackedFile): Promise<DependencyFile | undefined> {
    const parse = REQUIREMENTS_FILE.test(file.path)
        ? parseRequirements
        : DEPENDENCY_FILE_PARSERS.get(posix.basename(file.path));
    if (parse === undefined) return undefined;
    const text = read(reads, file.path);
    return await parse(file.path, text);
}

/**
Read the supported dependency files.

@param reads the run cache.
@param files the tracked inventory.
@returns one dependency file per supported source file.
*/
export async function readDependencyFiles(reads: ReadCache, files: TrackedFile[]): Promise<DependencyFile[]> {
    const dependencies: DependencyFile[] = [];
    for (const file of files) {
        if (file.kind !== 'source' || file.path.startsWith(`${GSPOT_FOLDER}/`) || isInInstalledFolder(file.path))
            continue;
        const dependencyFile = await readDependencyFile(reads, file);
        if (dependencyFile !== undefined) dependencies.push(dependencyFile);
    }
    return dependencies;
}

/**
Read and validate the package.json fields that gspot uses.

@param root the base folder of the path.
@param path the repository-relative package.json.
@returns the validated package fields, or undefined when the file does not exist.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Commands, generation, and repository reads validate package.json with one schema through it.
export function readPackageJson(root: string, path: string): PackageJson | undefined {
    const text = find(root, path);
    return text === undefined ? undefined : parseJsonFile(path, text, packageJsonSchema);
}

/**
Read the package.json fields used by repository checks through the run cache.

@param reads the cache rooted at the repository.
@param path the repository-relative package.json path.
@returns the validated fields, or undefined when the file does not exist.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Checks and repository reads validate package.json from the run cache with one schema through it.
export function readCachedPackageJson(reads: ReadCache, path: string): PackageJson | undefined {
    const text = find(reads, path);
    return text === undefined ? undefined : parseJsonFile(path, text, packageJsonSchema);
}

/**
Read the dependency specifiers declared for installation.

@param reads the cache rooted at the repository.
@param path the repository-relative package.json path.
@param sections the package.json dependency tables to read.
@returns undefined when the file does not exist.
*/
export function readDependencySpecifiers(
    reads: ReadCache,
    path: string,
    sections: readonly ((typeof DEPENDENCY_SECTIONS)[number] | 'peerDependencies')[] = DEPENDENCY_SECTIONS,
): Map<string, string> | undefined {
    const fields = readCachedPackageJson(reads, path);
    if (fields === undefined) return undefined;
    return new Map(
        sections.flatMap((section) => {
            const dependencies = fields[section];
            return dependencies === undefined ? [] : Object.entries(dependencies);
        }),
    );
}

/**
List the tool-only packages: each package.json that holds only declared npm tools and Git hook packages.

@param dependencyFiles the parsed files.
@param configurations the configurations that declare the npm tools.
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
List the dependency names of the nearest declared npm project that contains a scope.

@param dependencyFiles the validated files.
@param scopePath the repository-relative project folder.
@returns the declared dependency names. Child and sibling projects keep their own.
*/
export function listProjectDependencyNames(dependencyFiles: DependencyFile[], scopePath: string): string[] {
    const projects = new Map(
        dependencyFiles.filter((file) => file.kind === PACKAGE_JSON).map((file) => [file.path, file]),
    );
    const owner = listEnclosingFolders(scopePath)
        .map((folder) => projects.get(posix.join(folder, PACKAGE_JSON)))
        .find((file) => file !== undefined);
    return owner === undefined ? [] : Object.keys(owner.dependencies);
}

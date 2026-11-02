import { posix } from 'node:path';
import type { RunCache } from '#cli/types/system.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { findText, readText } from '#cli/system/files/reads.ts';
import type { PackageJson, DependencyFile } from '#cli/types/parsers.ts';
import { isInInstalledFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import { HOOK_PACKAGES, REQUIREMENTS_FILE } from '#cli/config/repository/files.ts';
import { parseRequirements, DEPENDENCY_FILE_PARSERS } from '#cli/parsers/projects/dependencies.ts';

/**
List the exact npm package names that the configurations declare.

@param configurations the configurations in use.
*/
function listNpmToolNames(configurations: Iterable<Configuration>): Set<string> {
    return new Set(
        [...configurations].flatMap((configuration) =>
            configuration.tools.flatMap((tool) => {
                const npm = tool.installers['npm'];
                return npm === undefined ? [] : npm.name;
            }),
        ),
    );
}

async function readDependencyFile(cache: RunCache, file: TrackedFile): Promise<DependencyFile | undefined> {
    const parse = REQUIREMENTS_FILE.test(file.path)
        ? parseRequirements
        : DEPENDENCY_FILE_PARSERS.get(posix.basename(file.path));
    if (parse === undefined) return undefined;
    const text = readText(cache, file.path);
    return await parse(file.path, text);
}

/**
Read the supported dependency files.

@param cache the run cache.
@param files the tracked inventory.
*/
export async function readDependencyFiles(cache: RunCache, files: TrackedFile[]): Promise<DependencyFile[]> {
    const dependencies: DependencyFile[] = [];
    for (const file of files) {
        if (file.kind !== 'source' || isGspotPath(file.path) || isInInstalledFolder(file.path)) continue;
        const dependencyFile = await readDependencyFile(cache, file);
        if (dependencyFile !== undefined) dependencies.push(dependencyFile);
    }
    return dependencies;
}

/**
Read and validate the package.json fields that gspot uses.

@param source the base folder of the path, or the run cache of that folder.
@param path the relative package.json.
@returns the validated package fields, or undefined when the file does not exist.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Commands, generation, checks, and repository reads validate package.json through it.
export function readPackageJson(source: string | RunCache, path: string): PackageJson | undefined {
    const text = findText(source, path);
    return text === undefined ? undefined : parseJsonFile(path, text, packageJsonSchema);
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

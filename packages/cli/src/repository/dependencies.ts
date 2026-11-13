import { posix } from 'node:path';

import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { HOOK_PACKAGES, REQUIREMENTS_FILE } from '#cli/config/repository/files.ts';
import { GSPOT_PACKAGES } from '#cli/config/repository/version-pin.ts';
import { DEPENDENCY_FILE_PARSERS, parseRequirements } from '#cli/parsers/projects/dependencies.ts';
import { tryParseFile } from '#cli/parsers/validation.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { readText } from '#cli/system/files/reads.ts';
import { isInInstalledFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { DependencyFile } from '#cli/types/parsers.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { RunCache } from '#cli/types/system.ts';

/**
List the exact npm package names of the tools that the configurations declare. A package that a configuration detects
as a dependency, such as vitest, is left out: the project uses it, so it marks a real project.
*/
function listNpmToolNames(configurations: Iterable<Configuration>): Set<string> {
    const selected = [...configurations];
    const toolNames = selected.flatMap(({ tools }) => tools.flatMap((tool) => tool.installers['npm']?.name ?? []));
    return new Set(toolNames).difference(new Set(selected.flatMap(({ detect }) => detect.dependencies)));
}

async function readDependencyFile(cache: RunCache, file: TrackedFile): Promise<DependencyFile | undefined> {
    const parse = REQUIREMENTS_FILE.test(file.path)
        ? parseRequirements
        : DEPENDENCY_FILE_PARSERS.get(posix.basename(file.path));
    if (parse === undefined) return undefined;
    const text = readText(cache, file.path);
    return await tryParseFile(() => parse(file.path, text));
}

/**
Tell whether a file is a source file of the project: not a file of gspot, and not inside an installed dependency folder.
*/
export function isProjectSource({ path, kind }: Pick<TrackedFile, 'path' | 'kind'>): boolean {
    return kind === 'source' && !isGspotPath(path) && !isInInstalledFolder(path);
}

export async function readDependencyFiles(cache: RunCache, files: TrackedFile[]): Promise<DependencyFile[]> {
    const dependencies: DependencyFile[] = [];
    for (const file of files) {
        if (!isProjectSource(file)) continue;
        const dependencyFile = await readDependencyFile(cache, file);
        if (dependencyFile !== undefined) dependencies.push(dependencyFile);
    }
    return dependencies;
}

export function listUnparsedDependencyFiles(files: TrackedFile[], dependencyFiles: DependencyFile[]): string[] {
    const parsed = new Set(dependencyFiles.map(({ path }) => path));
    return files
        .filter(
            (file) =>
                isProjectSource(file) &&
                DEPENDENCY_FILE_PARSERS.has(posix.basename(file.path)) &&
                !parsed.has(file.path),
        )
        .map(({ path }) => path);
}

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
                return (
                    names.length > 0 &&
                    names.every(
                        (name) =>
                            npmNames.has(name) ||
                            HOOK_PACKAGES.has(name) ||
                            (GSPOT_PACKAGES as readonly string[]).includes(name),
                    )
                );
            })
            .map((dependencyFile) => dependencyFile.path),
    );
}

/**
Find the package.json of the scope folder, or of the nearest folder above it that holds one.
*/
export function findNearestPackageJson(
    dependencyFiles: DependencyFile[],
    scopePath: string,
): DependencyFile | undefined {
    const projects = new Map(
        dependencyFiles.filter((file) => file.kind === PACKAGE_JSON).map((file) => [file.path, file]),
    );
    return listEnclosingFolders(scopePath)
        .map((folder) => projects.get(posix.join(folder, PACKAGE_JSON)))
        .find((file) => file !== undefined);
}

export function listProjectDependencyNames(dependencyFiles: DependencyFile[], scopePath: string): string[] {
    const owner = findNearestPackageJson(dependencyFiles, scopePath);
    return owner === undefined ? [] : Object.keys(owner.dependencies);
}

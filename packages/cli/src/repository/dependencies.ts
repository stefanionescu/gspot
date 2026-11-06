import { posix } from 'node:path';

import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { HOOK_PACKAGES, REQUIREMENTS_FILE } from '#cli/config/repository/files.ts';
import { GSPOT_PACKAGES } from '#cli/config/repository/javascript.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { DEPENDENCY_FILE_PARSERS, parseRequirements } from '#cli/parsers/projects/dependencies.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import { tryParseFile } from '#cli/system/errors.ts';
import { findText, readText } from '#cli/system/files/reads.ts';
import { isInInstalledFolder, listEnclosingFolders } from '#cli/system/paths.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { DependencyFile, PackageJson } from '#cli/types/parsers.ts';
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

export async function readDependencyFiles(cache: RunCache, files: TrackedFile[]): Promise<DependencyFile[]> {
    const dependencies: DependencyFile[] = [];
    for (const file of files) {
        if (file.kind !== 'source' || isGspotPath(file.path) || isInInstalledFolder(file.path)) continue;
        const dependencyFile = await readDependencyFile(cache, file);
        if (dependencyFile !== undefined) dependencies.push(dependencyFile);
    }
    return dependencies;
}

export function listUnparsedDependencyFiles(files: TrackedFile[], dependencyFiles: DependencyFile[]): string[] {
    const parsed = new Set(dependencyFiles.map(({ path }) => path));
    return files
        .filter(
            ({ path, kind }) =>
                kind === 'source' &&
                DEPENDENCY_FILE_PARSERS.has(posix.basename(path)) &&
                !parsed.has(path) &&
                !isGspotPath(path) &&
                !isInInstalledFolder(path),
        )
        .map(({ path }) => path);
}

export function readPackageJson(source: string | RunCache, path: string): PackageJson | undefined {
    const text = findText(source, path);
    return text === undefined ? undefined : parseJsonFile(path, text, packageJsonSchema);
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

export function listProjectDependencyNames(dependencyFiles: DependencyFile[], scopePath: string): string[] {
    const projects = new Map(
        dependencyFiles.filter((file) => file.kind === PACKAGE_JSON).map((file) => [file.path, file]),
    );
    const owner = listEnclosingFolders(scopePath)
        .map((folder) => projects.get(posix.join(folder, PACKAGE_JSON)))
        .find((file) => file !== undefined);
    return owner === undefined ? [] : Object.keys(owner.dependencies);
}

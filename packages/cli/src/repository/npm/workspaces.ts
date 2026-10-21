import { realpathSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { join, posix, dirname, relative } from 'node:path';
import { getCachedValue } from '#cli/system/files/cache.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { FOLDER_CONTENTS } from '#cli/config/system/paths.ts';
import { isInScope, joinScope } from '#cli/repository/scopes.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { listSourceFiles, readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import { PnpmTool, RushTool, YarnTool, LernaTool, type Package } from '@manypkg/tools';
import { isInside, convertToPosixPath, extractParentFolder, listEnclosingFolders } from '#cli/system/paths.ts';

function listWorkspacePackages(root: string): Package[] {
    let file = PACKAGE_JSON;
    try {
        const packageJson = readPackageJson(root, PACKAGE_JSON);
        for (const [tool, path] of [
            [PnpmTool, 'pnpm-workspace.yaml'],
            [LernaTool, 'lerna.json'],
            [RushTool, 'rush.json'],
        ] as const) {
            file = path;
            if (!tool.isMonorepoRootSync(root)) continue;
            return tool.getPackagesSync(root).packages;
        }
        if (packageJson?.workspaces === undefined) return [];
        file = PACKAGE_JSON;
        return YarnTool.getPackagesSync(root).packages;
    } catch (error) {
        if (!(error instanceof Error) || error instanceof GspotError) throw error;
        throw new GspotError('filesystem', `${file} is not a valid workspace file: ${error.message}. Fix the file.`, {
            cause: error,
        });
    }
}

const WORKSPACE_SOURCES = { create: () => new Map<string, string[]>() };

/**
 * Select the declared workspace sources from the inventory of this run.
 *
 * @param reads the run cache and base for resolving package and compiler files.
 * @param scope the owning project.
 * @param files the source inventory.
 * @returns workspace dependency paths.
 */
export function listWorkspaceDependencySources(reads: ReadCache, scope: string, files: TrackedFile[]): string[] {
    const source = reads.root;
    const cache = getCachedValue(reads, WORKSPACE_SOURCES);
    const tracked = new Set(files.map((file) => file.path));
    const packageJsonPath = listEnclosingFolders(scope)
        .map((folder) => joinScope(folder, PACKAGE_JSON))
        .find((path) => tracked.has(path));
    if (packageJsonPath === undefined) return [];
    const key = JSON.stringify([source, packageJsonPath]);
    const held = cache.get(key);
    if (held !== undefined) return held;
    const projectRoot = extractParentFolder(packageJsonPath);
    const ordered = [...new Set([projectRoot, ...listWorkspaceFolders(source)])].toSorted(
        (left, right) => right.length - left.length,
    );
    const packages = new Map(ordered.map((path) => [path, readPackageJson(source, posix.join(path, PACKAGE_JSON))]));
    const pending = [projectRoot];
    for (const folder of pending) {
        const packageJson = packages.get(folder);
        if (packageJson === undefined)
            throw new Error(`The workspace package.json is missing: ${posix.join(folder, PACKAGE_JSON)}`);
        const names = Object.keys({
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies,
            ...packageJson.optionalDependencies,
        });
        const typescriptProject = readTsconfigProject(source, folder, [], reads);
        const sources =
            typescriptProject === undefined
                ? []
                : listSourceFiles(source, folder, reads, {
                      ...typescriptProject.config,
                      fileNames: typescriptProject.config.fileNames.filter((file) =>
                          isInScope(convertToPosixPath(relative(source, file)), folder),
                      ),
                  }).flatMap(
                      (file) =>
                          ordered.find((path) =>
                              isInScope(convertToPosixPath(relative(source, file.fileName)), path),
                          ) ?? [],
                  );
        const dependencies = [...packages]
            .filter(([, dependency]) => dependency?.name !== undefined && names.includes(dependency.name))
            .map(([path]) => path);
        pending.push(...[...new Set([...sources, ...dependencies])].filter((path) => !pending.includes(path)));
    }
    const visited = new Set(pending);
    visited.delete(projectRoot);
    const selected = files
        .filter((file) => {
            const owner = ordered.find((entry) => isInScope(file.path, entry));
            return owner !== undefined && visited.has(owner);
        })
        .map((file) => file.path);
    const packageJsonPaths = [...visited].map((path) => posix.join(path, PACKAGE_JSON));
    selected.push(...listPackageFiles(source, packageJsonPaths));
    cache.set(key, selected);
    return selected;
}

/**
 * List the folders of the npm workspaces that the repository declares, without the root.
 *
 * @param repositoryRoot the boundary that declared workspace packages must remain inside.
 * @returns the root-relative folders.
 */
export function listWorkspaceFolders(repositoryRoot: string): string[] {
    const packages = listWorkspacePackages(repositoryRoot);
    for (const found of packages)
        if (!isInside(relative(realpathSync(repositoryRoot), realpathSync(found.dir))))
            throw new GspotError('filesystem', `Workspace package leaves the repository: ${found.relativeDir}`);
    return packages.map((found) => convertToPosixPath(found.relativeDir)).filter((path) => path !== '' && path !== '.');
}

/**
 * Select the existing files that package.json files declare for publication.
 *
 * @param repositoryRoot the base folder for the package.json files and their patterns.
 * @param packageJsonPaths the repository-relative package.json files to read.
 * @returns the repository-relative package files.
 */
export function listPackageFiles(repositoryRoot: string, packageJsonPaths: string[]): string[] {
    return packageJsonPaths.flatMap((path) => {
        const folder = dirname(path);
        const patterns = (readPackageJson(repositoryRoot, path)?.files ?? []).flatMap((pattern) => [
            pattern,
            pattern + FOLDER_CONTENTS,
        ]);
        return listMatchingPaths(join(repositoryRoot, folder), patterns).map((file) =>
            convertToPosixPath(join(folder, file)),
        );
    });
}

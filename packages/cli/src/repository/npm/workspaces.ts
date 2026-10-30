import { realpathSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { remember } from '#cli/system/files/cache.ts';
import { join, posix, dirname, relative } from 'node:path';
import type { ReadCache } from '#cli/types/system/files.ts';
import { isInScope, joinScope } from '#cli/repository/scopes.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import { FOLDER_CONTENTS } from '#cli/config/files/path-patterns.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { PnpmTool, RushTool, YarnTool, LernaTool, type Package } from '@manypkg/tools';
import { listSourceFiles, readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { RUSH_FILE, LERNA_FILE, PNPM_WORKSPACE_FILE } from '#cli/config/repository/npm.ts';
import { isInside, convertToPosixPath, extractParentFolder, listEnclosingFolders } from '#cli/system/paths.ts';

function listWorkspacePackages(root: string): Package[] {
    let file = PACKAGE_JSON;
    try {
        const packageJson = readPackageJson(root, PACKAGE_JSON);
        for (const [tool, path] of [
            [PnpmTool, PNPM_WORKSPACE_FILE],
            [LernaTool, LERNA_FILE],
            [RushTool, RUSH_FILE],
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

const WORKSPACE_SOURCES = Symbol('workspace sources');

function listWorkspaceImportFolders(reads: ReadCache, folder: string, ordered: string[]): string[] {
    const root = reads.root;
    const typescriptProject = readTsconfigProject(root, folder, [], reads);
    return typescriptProject === undefined
        ? []
        : listSourceFiles(root, folder, reads, {
              ...typescriptProject.config,
              fileNames: typescriptProject.config.fileNames.filter((file) =>
                  isInScope(convertToPosixPath(relative(root, file)), folder),
              ),
          }).flatMap(
              (file) =>
                  ordered.find((path) => isInScope(convertToPosixPath(relative(root, file.fileName)), path)) ?? [],
          );
}

/**
List the files of the workspace packages that a project imports or depends on, and the files that those packages
publish.

@param reads the run cache.
@param scopePath the owning project.
@param files the source inventory.
@returns the repository-relative paths.
*/
export function listWorkspaceDependencySources(reads: ReadCache, scopePath: string, files: TrackedFile[]): string[] {
    const root = reads.root;
    const tracked = new Set(files.map((file) => file.path));
    const packageJsonPath = listEnclosingFolders(scopePath)
        .map((folder) => joinScope(folder, PACKAGE_JSON))
        .find((path) => tracked.has(path));
    if (packageJsonPath === undefined) return [];
    return remember(reads, WORKSPACE_SOURCES, JSON.stringify([root, packageJsonPath]), () => {
        const projectRoot = extractParentFolder(packageJsonPath);
        const ordered = [...new Set([projectRoot, ...listWorkspaceFolders(root)])].toSorted(
            (left, right) => right.length - left.length,
        );
        const packages = new Map(ordered.map((path) => [path, readPackageJson(root, posix.join(path, PACKAGE_JSON))]));
        const pending = [projectRoot];
        let index = 0;
        while (index < pending.length) {
            const folder = pending[index] as string;
            index += 1;
            const packageJson = packages.get(folder);
            if (packageJson === undefined)
                throw new GspotError(
                    'filesystem',
                    `The workspace package.json is missing: ${posix.join(folder, PACKAGE_JSON)}`,
                );
            const names = Object.keys({
                ...packageJson.dependencies,
                ...packageJson.devDependencies,
                ...packageJson.peerDependencies,
                ...packageJson.optionalDependencies,
            });
            const sources = listWorkspaceImportFolders(reads, folder, ordered);
            const dependencies = [...packages]
                .filter(([, dependency]) => dependency?.name !== undefined && names.includes(dependency.name))
                .map(([path]) => path);
            pending.push(...[...new Set([...sources, ...dependencies])].filter((path) => !pending.includes(path)));
        }
        const visited = new Set(pending);
        visited.delete(projectRoot);
        const selected = files
            .filter((file) => {
                const owner = ordered.find((workspace) => isInScope(file.path, workspace));
                return owner !== undefined && visited.has(owner);
            })
            .map((file) => file.path);
        const packageJsonPaths = [...visited].map((path) => posix.join(path, PACKAGE_JSON));
        selected.push(...listPackageFiles(root, packageJsonPaths));
        return selected;
    });
}

/**
List the folders of the npm workspaces that the repository declares, without the root.

@param root the boundary that declared workspace packages must remain inside.
@returns the root-relative folders.
*/
export function listWorkspaceFolders(root: string): string[] {
    const packages = listWorkspacePackages(root);
    for (const found of packages)
        if (!isInside(relative(realpathSync(root), realpathSync(found.dir))))
            throw new GspotError('filesystem', `Workspace package leaves the repository: ${found.relativeDir}`);
    return packages.map((found) => convertToPosixPath(found.relativeDir)).filter((path) => path !== '' && path !== '.');
}

/**
Select the existing files that package.json files declare for publication.

@param root the base folder for the package.json files and their patterns.
@param packageJsonPaths the repository-relative package.json files to read.
@returns the repository-relative package files.
*/
export function listPackageFiles(root: string, packageJsonPaths: string[]): string[] {
    return packageJsonPaths.flatMap((path) => {
        const folder = dirname(path);
        const patterns = (readPackageJson(root, path)?.files ?? []).flatMap((pattern) => [
            pattern,
            pattern + FOLDER_CONTENTS,
        ]);
        return listMatchingPaths(join(root, folder), patterns).map((file) => convertToPosixPath(join(folder, file)));
    });
}

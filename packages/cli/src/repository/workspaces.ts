import { existsSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';

import { InvalidMonorepoError, LernaTool, PnpmTool, RushTool } from '@manypkg/tools';
import { globSync } from 'tinyglobby';
import { YAMLError } from 'yaml';
import { z } from 'zod';

import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { LERNA_FILE, PNPM_WORKSPACE_FILE, RUSH_FILE } from '#cli/config/repository/package-managers.ts';
import { FOLDER_CONTENTS } from '#cli/config/system.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { listSourceFiles, readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { remember } from '#cli/system/cache.ts';
import { GspotError } from '#cli/system/errors.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { findContainedPath, readText } from '#cli/system/files/reads.ts';
import { convertToPosixPath, extractParentFolder, isInScope, listEnclosingFolders } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { RunCache } from '#cli/types/system.ts';

const workspaceGlobsSchema = z.object({ packages: z.string().array().optional() });

/**
List the folders that workspace globs match and that hold a package.json, as the workspace tools do. gspot reads each
package.json itself later, so a byte order mark, which Node accepts, does not stop the listing.
*/
function expandWorkspaceGlobs(root: string, globs: string[]): string[] {
    return globSync(globs, { cwd: root, onlyDirectories: true, ignore: ['**/node_modules'], expandDirectories: false })
        .map((folder) => resolve(root, folder))
        .toSorted(compareText)
        .filter((folder) => existsSync(join(folder, PACKAGE_JSON)))
        .map((folder) => relative(root, folder));
}

/**
Run a call of the monorepo library that reads a workspace file. A malformed file makes the library throw a syntax
error from JSON, JSON5, or YAML, a type error for a value of the wrong shape, or, for a Rush project without a
package.json, an invalid monorepo error. Each of those names the file; any other error passes through.
*/
function readWorkspaceFile<Value>(file: string, read: () => Value): Value {
    try {
        return read();
    } catch (error) {
        if (
            !(error instanceof SyntaxError) &&
            !(error instanceof YAMLError) &&
            !(error instanceof TypeError) &&
            !(error instanceof InvalidMonorepoError)
        )
            throw error;
        throw new GspotError('filesystem', `${file} is not a valid workspace file: ${error.message}. Fix the file.`, {
            cause: error,
        });
    }
}

function listWorkspacePackages(root: string): string[] {
    const packageJson = readPackageJson(root, PACKAGE_JSON);
    const sources = [
        {
            file: PNPM_WORKSPACE_FILE,
            isRoot: () => PnpmTool.isMonorepoRootSync(root),
            list: () =>
                expandWorkspaceGlobs(
                    root,
                    parseYamlFile(PNPM_WORKSPACE_FILE, readText(root, PNPM_WORKSPACE_FILE), workspaceGlobsSchema)
                        .packages ?? [],
                ),
        },
        {
            file: LERNA_FILE,
            isRoot: () => LernaTool.isMonorepoRootSync(root),
            list: () =>
                expandWorkspaceGlobs(
                    root,
                    parseJsonFile(LERNA_FILE, readText(root, LERNA_FILE), workspaceGlobsSchema).packages ?? [
                        'packages/*',
                    ],
                ),
        },
        {
            file: RUSH_FILE,
            isRoot: () => RushTool.isMonorepoRootSync(root),
            list: () =>
                readWorkspaceFile(RUSH_FILE, () => RushTool.getPackagesSync(root)).packages.map(
                    (found) => found.relativeDir,
                ),
        },
        {
            file: PACKAGE_JSON,
            isRoot: () => packageJson?.workspaces !== undefined,
            list: () => {
                const workspaces = packageJson?.workspaces ?? [];
                return expandWorkspaceGlobs(root, Array.isArray(workspaces) ? workspaces : workspaces.packages);
            },
        },
    ];
    const source = sources.find(({ file, isRoot }) => readWorkspaceFile(file, isRoot));
    return source === undefined ? [] : source.list();
}

const WORKSPACE_SOURCES = Symbol('workspace sources');

function listWorkspaceImportFolders(cache: RunCache, folder: string, ordered: string[]): string[] {
    const root = cache.root;
    const typescriptProject = readTsconfigProject(root, folder, [], cache);
    return typescriptProject === undefined
        ? []
        : listSourceFiles(root, folder, cache, {
              ...typescriptProject.config,
              fileNames: typescriptProject.config.fileNames.filter((file) =>
                  isInScope(convertToPosixPath(relative(root, file)), folder),
              ),
          }).flatMap(
              (file) =>
                  ordered.find((path) => isInScope(convertToPosixPath(relative(root, file.fileName)), path)) ?? [],
          );
}

export function listWorkspaceSources(cache: RunCache, scopePath: string, files: TrackedFile[]): string[] {
    const root = cache.root;
    const tracked = new Set(files.map((file) => file.path));
    const packageJsonPath = listEnclosingFolders(scopePath)
        .map((folder) => joinScope(folder, PACKAGE_JSON))
        .find((path) => tracked.has(path));
    if (packageJsonPath === undefined) return [];
    return remember(cache, WORKSPACE_SOURCES, JSON.stringify([root, packageJsonPath]), () => {
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
            const sources = listWorkspaceImportFolders(cache, folder, ordered);
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

export function listWorkspaceFolders(root: string): string[] {
    const packages = listWorkspacePackages(root);
    for (const found of packages)
        if (findContainedPath(root, found) === undefined)
            throw new GspotError(
                'filesystem',
                `Workspace package ${found} leaves the repository. Remove it from the workspace list, or replace the link with a folder in the repository.`,
            );
    return packages.map((found) => convertToPosixPath(found)).filter((path) => path !== '' && path !== '.');
}

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

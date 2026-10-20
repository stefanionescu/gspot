// Read npm workspaces, installed packages, and their source files.

import { createRequire } from 'node:module';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { realpathSync, readFileSync } from 'node:fs';
import { isInScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { FOLDER_CONTENTS } from '#cli/config/system/paths.ts';
import { listMatchingPaths } from '#cli/system/files/folders.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { packageJsonSchema } from '#cli/parsers/dependency-files.ts';
import { join, posix, dirname, basename, relative } from 'node:path';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { GspotError, isMissingFileError } from '#cli/system/errors.ts';
import { type Files, type ReadCache } from '#cli/types/system/files.ts';
import { listSourceFiles, readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import { PnpmTool, RushTool, YarnTool, LernaTool, type Package } from '@manypkg/tools';
import { type PackageJson, type InstalledDependency } from '#cli/types/parsers/dependency-files.ts';

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

const WORKSPACE_FILES_MEMO = { create: () => new Map<string, string[]>() };

/**
 * Select the declared workspace sources from the inventory of this run.
 *
 * @param source the base folder for resolving inventoried package and compiler files.
 * @param scope the owning project.
 * @param files the source inventory.
 * @param reads the run cache.
 * @returns workspace dependency paths.
 */
function listWorkspaceDependencyFiles(source: string, scope: string, files: TrackedFile[], reads: ReadCache): string[] {
    const cache = getCachedValue(reads, WORKSPACE_FILES_MEMO);
    const manifestPath = files
        .map((file) => file.path)
        .filter((path) => basename(path) === PACKAGE_JSON && isInScope(scope, posix.relative('.', posix.dirname(path))))
        .toSorted((left, right) => right.length - left.length)[0];
    if (manifestPath === undefined) return [];
    const key = JSON.stringify([source, manifestPath]);
    const held = cache.get(key);
    if (held !== undefined) return held;
    const projectRoot = posix.relative('.', posix.dirname(manifestPath));
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

/**
 * Read and validate a package.json outside the tool project, without its boundary.
 *
 * @param path the absolute package.json file.
 * @returns the package metadata, or undefined when the file does not exist.
 */
export function readHostPackage(path: string): PackageJson | undefined {
    let text: string;
    try {
        text = readFileSync(path, 'utf8');
    } catch (error) {
        if (isMissingFileError(error)) return undefined;
        throw error;
    }
    return parseJsonFile(path, text, packageJsonSchema);
}

/**
 * Read and validate installed metadata through the tool-project boundary.
 *
 * @param files the confined file handle of the tool project.
 * @param repositoryRoot the boundary for resolving and validating installed package.json paths.
 * @param path the absolute package.json file.
 * @returns the package metadata, or undefined when the file does not exist.
 */
export function readToolProjectPackage(files: Files, repositoryRoot: string, path: string): PackageJson | undefined {
    let target: string;
    try {
        target = files.readRealPath(convertToPosixPath(relative(repositoryRoot, path)));
    } catch (error) {
        if (isMissingFileError(error)) return undefined;
        throw error;
    }
    const local = convertToPosixPath(relative(repositoryRoot, target));
    const text = readText(repositoryRoot, local);
    return text === undefined ? undefined : parseJsonFile(path, text, packageJsonSchema);
}

/**
 * Read the path and version of an installed package, hoisted or not, as its dependency file resolves it.
 *
 * @param repositoryRoot the base folder for resolving the dependency file.
 * @param packageJsonPath the repository-relative package.json used as the module-resolution base.
 * @param name the package to resolve through the dependency file.
 * @returns the resolved package.json and its version, or undefined when the dependency does not exist.
 */
export function findInstalledDependency(
    repositoryRoot: string,
    packageJsonPath: string,
    name: string,
): InstalledDependency | undefined {
    const require = createRequire(join(repositoryRoot, packageJsonPath));
    let path: string;
    try {
        path = require.resolve(`${name}/package.json`);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') return undefined;
        throw error;
    }
    return { path, version: readHostPackage(path)?.version };
}

export { listWorkspaceDependencyFiles };

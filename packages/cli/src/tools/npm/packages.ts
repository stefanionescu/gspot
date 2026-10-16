// Read npm workspaces, installed packages, and their source files.

import { createRequire } from 'node:module';
import { GspotError } from '#cli/system/errors.ts';
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
import { type Files, type ReadCache } from '#cli/types/system/files.ts';
import { listSourceFiles, readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import { PnpmTool, RushTool, YarnTool, LernaTool, type Package } from '@manypkg/tools';
import { type PackageJson, type InstalledDependency } from '#cli/types/parsers/dependency-files.ts';

function listWorkspacePackages(root: string): Package[] {
    const manifest = readPackageJson(root, PACKAGE_JSON);
    for (const tool of [PnpmTool, LernaTool, RushTool]) {
        if (!tool.isMonorepoRootSync(root)) continue;
        return tool.getPackagesSync(root).packages;
    }
    if (manifest === undefined) return [];
    const { workspaces: declaration = [] } = manifest;
    const workspaces = Array.isArray(declaration) ? declaration : declaration.packages;
    if (workspaces.length === 0) return [];
    return YarnTool.getPackagesSync(root).packages;
}

const WORKSPACE_FILES_MEMO = { create: () => new Map<string, string[]>() };

/**
 * Select declared workspace sources from this run's repository inventory.
 * @param source the base folder for resolving inventoried package and compiler files.
 * @param scope the owning project.
 * @param files the source inventory.
 * @param reads the metadata cache.
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
        const manifest = packages.get(folder);
        if (manifest === undefined)
            throw new Error(`Workspace manifest is missing: ${posix.join(folder, PACKAGE_JSON)}`);
        const names = Object.keys({
            ...manifest.dependencies,
            ...manifest.devDependencies,
            ...manifest.peerDependencies,
            ...manifest.optionalDependencies,
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
 * The folders of the npm package workspaces the repository declares, the root left out.
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
 * Select existing files that package manifests declare for publication.
 * @param repositoryRoot the base folder for reading manifests and expanding their publication patterns.
 * @param packageJsonPaths the repository-relative manifests whose files patterns select publication content.
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
 * Read and validate a host package.json without the tool-project boundary.
 * @param path the absolute package.json path.
 * @returns the package metadata, or undefined when the file does not exist.
 */
export function readHostPackage(path: string): PackageJson | undefined {
    let text: string;
    try {
        text = readFileSync(path, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
    return parseJsonFile(path, text, packageJsonSchema);
}

/**
 * Read and validate installed metadata through the tool-project boundary.
 * @param files the confined tool-project files.
 * @param repositoryRoot the boundary for resolving and validating installed manifest paths.
 * @param path the absolute package.json path.
 * @returns the package metadata, or undefined when the file does not exist.
 */
export function readToolProjectPackage(files: Files, repositoryRoot: string, path: string): PackageJson | undefined {
    let target: string;
    try {
        target = files.readRealPath(convertToPosixPath(relative(repositoryRoot, path)));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
    const local = convertToPosixPath(relative(repositoryRoot, target));
    const text = readText(repositoryRoot, local);
    return text === undefined ? undefined : parseJsonFile(path, text, packageJsonSchema);
}

/**
 * Read the path and version of a dependency resolved from its actual project manifest, including hoisted installations.
 * @param repositoryRoot the base folder for resolving the source project manifest.
 * @param manifest the repository-relative package.json used as the module-resolution base.
 * @param name the package to resolve through the source project manifest.
 * @returns the resolved manifest and its version, or undefined when the dependency does not exist.
 */
export function findInstalledDependency(
    repositoryRoot: string,
    manifest: string,
    name: string,
): InstalledDependency | undefined {
    const require = createRequire(join(repositoryRoot, manifest));
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

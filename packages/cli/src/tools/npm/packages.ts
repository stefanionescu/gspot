// Reads npm workspaces, installed packages, and their source files.

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
 * The folders of the npm package workspaces the repository declares, the root left out.
 * @param root the repository root.
 * @returns the root-relative folders.
 */
function listWorkspaceFolders(root: string): string[] {
    const packages = listWorkspacePackages(root);
    for (const found of packages)
        if (!isInside(relative(realpathSync(root), realpathSync(found.dir))))
            throw new GspotError('filesystem', `Workspace package leaves the repository: ${found.relativeDir}`);
    return packages.map((found) => convertToPosixPath(found.relativeDir)).filter((path) => path !== '' && path !== '.');
}

/**
 * Select declared workspace sources from this run's repository inventory.
 * @param root the source root.
 * @param scope the owning project.
 * @param files the source inventory.
 * @param reads the metadata cache.
 * @returns workspace dependency paths.
 */
function listWorkspaceDependencyFiles(root: string, scope: string, files: TrackedFile[], reads: ReadCache): string[] {
    const cache = getCachedValue(reads, WORKSPACE_FILES_MEMO);
    const manifestPath = files
        .map((file) => file.path)
        .filter((path) => basename(path) === PACKAGE_JSON && isInScope(scope, posix.relative('.', posix.dirname(path))))
        .toSorted((left, right) => right.length - left.length)[0];
    if (manifestPath === undefined) return [];
    const key = JSON.stringify([root, manifestPath]);
    const held = cache.get(key);
    if (held !== undefined) return held;
    const projectRoot = posix.relative('.', posix.dirname(manifestPath));
    const ordered = [...new Set([projectRoot, ...listWorkspaceFolders(root)])].toSorted(
        (left, right) => right.length - left.length,
    );
    const packages = new Map(ordered.map((path) => [path, readPackageJson(root, posix.join(path, PACKAGE_JSON))]));
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
        const typescriptProject = readTsconfigProject(root, folder, [], reads);
        const sources =
            typescriptProject === undefined
                ? []
                : listSourceFiles(root, folder, reads, {
                      ...typescriptProject.config,
                      fileNames: typescriptProject.config.fileNames.filter((file) =>
                          isInScope(convertToPosixPath(relative(root, file)), folder),
                      ),
                  }).flatMap(
                      (file) =>
                          ordered.find((path) => isInScope(convertToPosixPath(relative(root, file.fileName)), path)) ??
                          [],
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
    selected.push(...listPackageFiles(root, packageJsonPaths));
    cache.set(key, selected);
    return selected;
}

/**
 * Select existing files that package manifests declare for publication.
 * @param root the repository root.
 * @param packageJsonPaths the package.json paths.
 * @returns the repository-relative package files.
 */
function listPackageFiles(root: string, packageJsonPaths: string[]): string[] {
    return packageJsonPaths.flatMap((path) => {
        const folder = dirname(path);
        const patterns = (readPackageJson(root, path)?.files ?? []).flatMap((pattern) => [
            pattern,
            pattern + FOLDER_CONTENTS,
        ]);
        return listMatchingPaths(join(root, folder), patterns).map((file) => convertToPosixPath(join(folder, file)));
    });
}

/**
 * Read package metadata from a tool project installation or a host installation.
 * @param files the tool project installation boundary, or undefined for a host installation.
 * @param root the repository root owning the tool-project boundary.
 * @param manifest the absolute package.json path.
 * @returns the validated package fields, or undefined when the file does not exist.
 */
function installedPackage(files: Files | undefined, root: string, manifest: string): PackageJson | undefined {
    try {
        let text: string | undefined;
        if (files === undefined) text = readFileSync(manifest, 'utf8');
        else {
            const folder = files.realPath(convertToPosixPath(relative(root, dirname(manifest))));
            const path = convertToPosixPath(relative(root, join(folder, basename(manifest))));
            text = readText(root, path);
        }
        return text === undefined ? undefined : parseJsonFile(manifest, text, packageJsonSchema);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Read the path and version of a dependency resolved from its actual project manifest, including hoisted installations.
 * @param root the repository root.
 * @param manifest the repository-relative source project manifest.
 * @param name the installed dependency name.
 * @returns the resolved manifest and its version, or undefined when the dependency does not exist.
 */
function findInstalledDependency(root: string, manifest: string, name: string): InstalledDependency | undefined {
    const require = createRequire(join(root, manifest));
    let path: string;
    try {
        path = require.resolve(`${name}/package.json`);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') return undefined;
        throw error;
    }
    return { path, version: installedPackage(undefined, root, path)?.version };
}

export {
    listPackageFiles,
    installedPackage,
    listWorkspaceFolders,
    findInstalledDependency,
    listWorkspaceDependencyFiles,
};

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

function workspacePackages(root: string): Package[] {
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

const WORKSPACE_SOURCE_MEMO = { create: () => new Map<string, string[]>() };

/**
 * The folders of the npm package workspaces the repository declares, the root left out.
 * @param root the repository root.
 * @returns the root-relative folders.
 */
function packageWorkspaces(root: string): string[] {
    const packages = workspacePackages(root);
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
function workspaceSourceFiles(root: string, scope: string, files: TrackedFile[], reads: ReadCache): string[] {
    const cache = getCachedValue(reads, WORKSPACE_SOURCE_MEMO);
    const project = files
        .map((file) => file.path)
        .filter(
            (path) => basename(path) === 'package.json' && isInScope(scope, posix.relative('.', posix.dirname(path))),
        )
        .toSorted((left, right) => right.length - left.length)[0];
    if (project === undefined) return [];
    const key = JSON.stringify([root, project]);
    const held = cache.get(key);
    if (held !== undefined) return held;
    const projectFolder = posix.relative('.', posix.dirname(project));
    const ordered = [...new Set([projectFolder, ...packageWorkspaces(root)])].toSorted(
        (left, right) => right.length - left.length,
    );
    const packages = new Map(ordered.map((path) => [path, readPackageJson(root, posix.join(path, 'package.json'))]));
    const pending = [projectFolder];
    for (const folder of pending) {
        const manifest = packages.get(folder);
        if (manifest === undefined)
            throw new Error(`Workspace manifest is missing: ${posix.join(folder, 'package.json')}`);
        const names = Object.keys({
            ...manifest.dependencies,
            ...manifest.devDependencies,
            ...manifest.peerDependencies,
            ...manifest.optionalDependencies,
        });
        const project = readTsconfigProject(root, folder, [], reads);
        const sources =
            project === undefined
                ? []
                : listSourceFiles(root, folder, reads, {
                      ...project.config,
                      fileNames: project.config.fileNames.filter((file) =>
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
    visited.delete(projectFolder);
    const selected = files
        .filter((file) => {
            const owner = ordered.find((entry) => isInScope(file.path, entry));
            return owner !== undefined && visited.has(owner);
        })
        .map((file) => file.path);
    const packageManifests = [...visited].map((path) => posix.join(path, PACKAGE_JSON));
    selected.push(...packageFiles(root, packageManifests));
    cache.set(key, selected);
    return selected;
}

/**
 * Select existing files that package manifests declare for publication.
 * @param root the repository root.
 * @param manifests the package.json paths.
 * @returns the repository-relative package files.
 */
function packageFiles(root: string, manifests: string[]): string[] {
    return manifests.flatMap((path) => {
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
            const directory = files.realPath(convertToPosixPath(relative(root, dirname(manifest))));
            const path = convertToPosixPath(relative(root, join(directory, basename(manifest))));
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
function installedDependency(root: string, manifest: string, name: string): InstalledDependency | undefined {
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

export { packageFiles, installedPackage, packageWorkspaces, installedDependency, workspaceSourceFiles };

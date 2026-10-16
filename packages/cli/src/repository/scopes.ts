// Discovers project scopes and resolves paths within them.
import picomatch from 'picomatch';
import { realpathSync } from 'node:fs';
import type { Package } from '@manypkg/tools';
import { GspotError } from '#cli/system/errors.ts';
import { posix, basename, relative } from 'node:path';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { type ReadCache } from '#cli/types/system/files.ts';
import { ROOT_SCOPE } from '#cli/config/repository/scopes.ts';
import { npmToolNames } from '#cli/configurations/tool-pins.ts';
import { TOOL_FILE_PREFIX } from '#cli/config/system/locations.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { PnpmTool, RushTool, YarnTool, LernaTool } from '@manypkg/tools';
import { projectSources, readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import type { Manifest, ToolFileDeclaration } from '#cli/types/configurations.ts';
import type { ScopeEntry, TrackedFile } from '#cli/types/repository/inventory.ts';
import { packageFiles, readPackageJson } from '#cli/repository/dependency-files.ts';
import type { DependencyMap, DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import { GLOB_EXCLUDE, FOLDER_CONTENTS, WHOLE_TREE_GLOBS } from '#cli/config/system/paths.ts';
import { literalGlob, isToolingPath, isToolsOnlyPackage } from '#cli/repository/selectors.ts';

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
 * Test scope containment. The empty root path matches every file.
 * @param path the file path.
 * @param scope the scope path.
 * @returns whether the scope contains the file.
 */
export function isInScope(path: string, scope: string): boolean {
    return scope === '' || path === scope || path.startsWith(`${scope}/`);
}

/**
 * Lists the scopes inside another scope, excluding that scope itself.
 * @param paths every scope path.
 * @param scope the parent scope, empty for the repository root.
 * @returns the nested paths in their original order.
 */
export function nestedScopes(paths: readonly string[], scope: string): string[] {
    return paths.filter((path) => path !== scope && isInScope(path, scope));
}

/**
 * Orders scope paths from outermost to innermost, then by name.
 * @param left the first scope path.
 * @param right the second scope path.
 * @returns the comparison result.
 */
export function byScopeDepth(left: string, right: string): number {
    const leftDepth = left === '' ? 0 : left.split('/').length;
    const rightDepth = right === '' ? 0 : right.split('/').length;
    return leftDepth - rightDepth || left.localeCompare(right);
}

/**
 * Determine whether positive literal selectors cover a complete project scope.
 * @param paths the root-relative inclusion and exclusion selectors.
 * @param scope the project scope, empty for the root.
 * @returns true only when no exclusion or partial selector leaves scope content active.
 */
export function coversScope(paths: string[], scope: string): boolean {
    if (paths.some((path) => path.startsWith(GLOB_EXCLUDE))) return false;
    if (WHOLE_TREE_GLOBS.some((pattern) => paths.includes(pattern))) return true;
    if (scope === '') return false;
    const segments = scope.split('/');
    return segments.some((_, index) => {
        const literal = literalGlob(segments.slice(0, index + 1).join('/'));
        return paths.includes(literal) || paths.includes(`${literal}${FOLDER_CONTENTS}`);
    });
}

/**
 * Determine whether a path belongs to none of the nested project scopes.
 * @param path the repository-relative source or deleted trigger path.
 * @param children the nested project scope paths.
 * @returns whether the parent scope owns this path.
 */
export function isOutsideChildren(path: string, children: string[]): boolean {
    return children.every((child) => !isInScope(path, child));
}

/**
 * Resolve a scope-relative path within its repository.
 * @param scope the repository-relative scope.
 * @param path the scope-relative path.
 * @returns the repository-relative path.
 */
export function joinScope(scope: string, path: string): string {
    return scope === '' ? path : `${scope}/${path}`;
}

/**
 * The repository-relative path of a tool file generated for a scope.
 * @param scope the scope path, empty for the root.
 * @param toolFile the tool-file declaration.
 * @param generatedPaths the files emitted by this session.
 * @returns the scopePath file or its emitted root fallback.
 */
export function targetInScope(
    scope: string,
    toolFile: ToolFileDeclaration,
    generatedPaths: ReadonlySet<string>,
): string {
    if (scope === '' || !toolFile.per_scope) return toolFile.target;
    const scopePath = toolFile.target.startsWith(TOOL_FILE_PREFIX)
        ? posix.join(TOOL_FILE_PREFIX, scope, toolFile.target.slice(TOOL_FILE_PREFIX.length))
        : joinScope(scope, toolFile.target);
    return !generatedPaths.has(scopePath) && generatedPaths.has(toolFile.target) ? toolFile.target : scopePath;
}

/**
 * Find project scopes for initialization and execution. Omit the root and lint-only packages.
 * @param files the repository inventory.
 * @param packageManifests the parsed package manifests.
 * @param manifests the configuration manifests declaring project files and npm tools.
 * @returns project scopes in path order.
 */
export function findScopes(
    files: TrackedFile[],
    packageManifests: DependencyFile[],
    manifests: Iterable<Manifest>,
): ScopeEntry[] {
    const configurations = [...manifests];
    const patterns = configurations.flatMap((manifest) => manifest.detect.project_files);
    const npmNames = npmToolNames(configurations);
    const lintOnly = new Set(
        packageManifests.filter((fact) => isToolsOnlyPackage(fact, npmNames)).map((fact) => fact.path),
    );
    const folders = new Set<string>();
    const sources = files.filter(
        (file) => file.kind === 'source' && !lintOnly.has(file.path) && !isToolingPath(file.path),
    );
    for (const file of sources) {
        for (const pattern of patterns) {
            const folder = projectFolder(file.path, pattern);
            if (folder !== undefined && folder !== '') folders.add(folder);
        }
    }
    return [...folders]
        .toSorted((left, right) => left.localeCompare(right))
        .map((path): ScopeEntry => ({ path, configurations: [], source: 'project' }));
}

/**
 * The folders of the npm package workspaces the repository declares, the root left out.
 * @param root the repository root.
 * @returns the root-relative folders.
 */
export function packageWorkspaces(root: string): string[] {
    const packages = workspacePackages(root);
    for (const found of packages)
        if (!isInside(relative(realpathSync(root), realpathSync(found.dir))))
            throw new GspotError('filesystem', `Workspace package leaves the repository: ${found.relativeDir}`);
    return packages.map((found) => convertToPosixPath(found.relativeDir)).filter((path) => path !== '' && path !== '.');
}

/**
 * The folder a project file marks: the path before the segments the pattern names, when the file carries them.
 * @param path the tracked file, root-relative.
 * @param pattern a project file name, a folder name such as `*.xcodeproj`, or a short path such as `supabase/config.toml`.
 * @returns the project folder, '' for the root, or undefined for other files.
 */
export function projectFolder(path: string, pattern: string): string | undefined {
    const segments = path.split('/');
    const wanted = pattern.split('/');
    for (let start = 0; start + wanted.length <= segments.length; start += 1) {
        const window = segments.slice(start, start + wanted.length);
        if (
            wanted.every((part, index) => {
                const segment = window[index];
                return (
                    segment !== undefined &&
                    (picomatch.scan(part).isGlob ? picomatch.isMatch(segment, part, { dot: true }) : part === segment)
                );
            })
        )
            return segments.slice(0, start).join('/');
    }
    return undefined;
}

/**
 * The scope a file belongs to: the deepest scope whose path contains it, else the root.
 * @param path the file path.
 * @param scopes the scopes.
 * @returns the scope.
 */
export function scopeOf(path: string, scopes: ScopeEntry[]): ScopeEntry {
    const root: ScopeEntry = scopes.find((scope) => scope.path === '') ?? { ...ROOT_SCOPE, configurations: [] };
    return (
        scopes
            .filter((scope) => scope.path !== '' && isInScope(path, scope.path))
            .toSorted((left, right) => right.path.length - left.path.length)[0] ?? root
    );
}

/**
 * Get dependencies from the nearest declared npm project that contains a scope.
 * @param manifests validated source project manifests.
 * @param scope the repository-relative project scope.
 * @returns declared dependencies without borrowing from children or siblings.
 */
export function projectDependencies(manifests: DependencyFile[], scope: string): DependencyMap {
    const owner = manifests
        .filter(
            (manifest) =>
                manifest.kind === 'package.json' &&
                isInScope(scope, manifest.path === 'package.json' ? '' : posix.dirname(manifest.path)),
        )
        .toSorted((first, second) => second.path.length - first.path.length)[0];
    if (owner === undefined) return {};
    return owner.dependencies;
}

/**
 * Select declared workspace sources from this run's repository inventory.
 * @param root the source root.
 * @param scope the owning project.
 * @param files the source inventory.
 * @param reads the metadata cache.
 * @returns workspace dependency paths.
 */
export function workspaceSourceFiles(root: string, scope: string, files: TrackedFile[], reads: ReadCache): string[] {
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
                : projectSources(root, folder, reads, {
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

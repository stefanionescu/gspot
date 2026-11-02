import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { posix, resolve, relative } from 'node:path';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { DependencyFile } from '#cli/types/parsers.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { GLOB_EXCLUDE, FOLDER_CONTENTS } from '#cli/config/system.ts';
import { listToolOnlyPackages } from '#cli/repository/dependencies.ts';
import type { ScopeFolder, TrackedFile } from '#cli/types/repository.ts';
import { DEPENDENCY_FILE_PARSERS } from '#cli/parsers/projects/dependencies.ts';
import { LINT_FOLDERS, EVERY_FILE_GLOBS } from '#cli/config/repository/setup.ts';

import {
    isInside,
    escapeGlob,
    convertToPosixPath,
    findEnclosingFolder,
    isInInstalledFolder,
} from '#cli/system/paths.ts';

const scopeFolderSets = new WeakMap<readonly { path: string }[], ReadonlySet<string>>();

/**
Build a command path from its calling folder within the repository.

@param root the folder that bounds command paths.
@param cwd the folder where the command starts.
@param subject the path as typed.
@returns the repository-relative path with forward slashes.
*/
export function buildArgumentPath(root: string, cwd: string, subject: string): string {
    const path = convertToPosixPath(relative(root, resolve(cwd, subject)));
    if (!isInside(path)) throw new GspotError('arguments', `Path ${subject} is outside this repository.`);
    return path;
}

/**
Test scope containment. The empty root path matches every file.

@param path the file to test.
@param scope the folder that may contain the file.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers test scope containment by this rule: the root scope, an empty path, holds every path.
export function isInScope(path: string, scope: string): boolean {
    return scope === '' || path === scope || path.startsWith(`${scope}/`);
}

/**
Lists the scopes inside another scope, excluding that scope itself.

@param paths every scope path.
@param scope the parent folder, empty for the repository root.
@returns the nested paths in their original order.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Checks, generation, and planning list nested scopes by this rule: inside the scope, and not the scope itself.
export function listNestedScopes(paths: readonly string[], scope: string): string[] {
    return paths.filter((path) => path !== scope && isInScope(path, scope));
}

/**
Orders scope paths from outermost to innermost, then by name.

@param left the first scope path.
@param right the second scope path.
*/
export function compareScopeDepth(left: string, right: string): number {
    const leftDepth = left === '' ? 0 : left.split('/').length;
    const rightDepth = right === '' ? 0 : right.split('/').length;
    return leftDepth - rightDepth || compareText(left, right);
}

/**
Check whether literal include selectors cover a whole project scope.

@param paths the root-relative inclusion and exclusion selectors.
@param scopePath the project folder, empty for the root.
@returns true only when no exclusion or partial selector leaves scope content active.
*/
export function isScopeCovered(paths: string[], scopePath: string): boolean {
    if (paths.some((path) => path.startsWith(GLOB_EXCLUDE))) return false;
    if (EVERY_FILE_GLOBS.some((pattern) => paths.includes(pattern))) return true;
    if (scopePath === '') return false;
    const segments = scopePath.split('/');
    return segments.some((_, index) => {
        const literal = escapeGlob(segments.slice(0, index + 1).join('/'));
        return paths.includes(literal) || paths.includes(`${literal}${FOLDER_CONTENTS}`);
    });
}

/**
Resolve a scope-relative path within its repository.

@param scope the repository-relative folder.
@param path the scope-relative file.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers join a path to its scope by this rule: the root scope, an empty path, adds no prefix.
export function joinScope(scope: string, path: string): string {
    return scope === '' ? path : `${scope}/${path}`;
}

/**
List the project scopes, without the root, tool-only packages, and a dependency file that does not parse, such as a test
fixture.

@param files the repository inventory.
@param dependencyFiles the parsed dependency files.
@param configurations the configurations with project files and npm tools.
@returns project scopes in path order.
*/
export function detectScopeFolders(
    files: TrackedFile[],
    dependencyFiles: DependencyFile[],
    configurations: Iterable<Configuration>,
): ScopeFolder[] {
    const selected = [...configurations];
    const toolOnlyPackages = listToolOnlyPackages(dependencyFiles, selected);
    const parsed = new Set(dependencyFiles.map(({ path }) => path));
    const sources = files.filter(
        (file) =>
            file.kind === 'source' &&
            !toolOnlyPackages.has(file.path) &&
            (parsed.has(file.path) || !DEPENDENCY_FILE_PARSERS.has(posix.basename(file.path))) &&
            !(file.path.startsWith(`${GSPOT_FOLDER}/`) || isInInstalledFolder(file.path)) &&
            LINT_FOLDERS.every((folder) => !file.path.startsWith(`${folder}/`)),
    );
    const folders = listProjectFolders(
        sources.map((file) => file.path),
        selected,
    );
    return [...folders]
        .filter((path) => path !== '')
        .toSorted((left, right) => compareText(left, right))
        .map((path): ScopeFolder => ({ path, configurations: [], origin: 'project' }));
}

/**
List the folders that the project files of the configurations mark.

@param paths the repository-relative files.
@param configurations the configurations with project files.
@returns the project folders, with '' for the root.
*/
export function listProjectFolders(paths: Iterable<string>, configurations: Configuration[]): Set<string> {
    const patterns = configurations.flatMap((configuration) => configuration.detect.project_files);
    const folders = new Set<string>();
    for (const path of paths)
        for (const pattern of patterns) {
            const folder = findProjectFolder(path, pattern);
            if (folder !== undefined) folders.add(folder);
        }
    return folders;
}

/**
Find the folder that a project file marks: the path before the segments that the pattern names.

@param path the tracked file, root-relative.
@param pattern a project file name, a folder name such as `*.xcodeproj`, or a short path such as `supabase/config.toml`.
@returns the project folder, '' for the root, or undefined for other files.
*/
export function findProjectFolder(path: string, pattern: string): string | undefined {
    const segments = path.split('/');
    const wanted = pattern.split('/');
    for (let start = 0; start + wanted.length <= segments.length; start += 1) {
        const window = segments.slice(start, start + wanted.length);
        if (
            wanted.every((glob, index) => {
                const segment = window[index];
                return segment !== undefined && buildPathMatcher([glob])(segment);
            })
        )
            return segments.slice(0, start).join('/');
    }
    return undefined;
}

/**
Check whether a path sits outside every child scope.

@param path the repository-relative path.
@param children the nested scope folders.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The file selection, the generators, and the checks of several languages share this one test.
export function isOutsideChildScopes(path: string, children: readonly string[]): boolean {
    return children.every((child) => !isInScope(path, child));
}

/**
Find the scope of a file: the deepest scope that contains it, else the root.

@param path the file to place.
@param scopes the scopes to search.
*/
export function selectScopePath(path: string, scopes: readonly { path: string }[]): string {
    let folders = scopeFolderSets.get(scopes);
    if (folders === undefined) {
        folders = new Set(scopes.map((scope) => scope.path));
        scopeFolderSets.set(scopes, folders);
    }
    return findEnclosingFolder(path, folders) ?? '';
}

/**
Find the scope that owns a path. Every session holds the root scope, so a scope always owns it.

@param path the file or scope folder to place.
@param scopes the scopes to search.
*/
export function selectScope<Entry extends { path: string }>(path: string, scopes: readonly Entry[]): Entry {
    const owner = selectScopePath(path, scopes);
    const scope = scopes.find((each) => each.path === owner);
    if (scope === undefined) throw new Error(`No scope owns ${path}.`);
    return scope;
}

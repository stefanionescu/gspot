import { resolve, relative } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { LINT_FOLDERS } from '#cli/config/repository/setup.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { EVERY_FILE_GLOBS } from '#cli/config/repository/scopes.ts';
import { listToolOnlyPackages } from '#cli/repository/dependencies.ts';
import type { ScopeFolder, TrackedFile } from '#cli/types/repository/files.ts';
import type { DependencyFile } from '#cli/types/parsers/projects/dependencies.ts';
import { GLOB_EXCLUDE, FOLDER_CONTENTS } from '#cli/config/files/path-patterns.ts';
import { isInside, escapeGlob, convertToPosixPath, isInInstalledFolder } from '#cli/system/paths.ts';

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
@returns whether the scope contains the file.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 44 calls in 25 files share it.
export function isInScope(path: string, scope: string): boolean {
    return scope === '' || path === scope || path.startsWith(`${scope}/`);
}

/**
Lists the scopes inside another scope, excluding that scope itself.

@param paths every scope path.
@param scope the parent folder, empty for the repository root.
@returns the nested paths in their original order.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 11 calls in 8 files share it.
export function listNestedScopes(paths: readonly string[], scope: string): string[] {
    return paths.filter((path) => path !== scope && isInScope(path, scope));
}

/**
Orders scope paths from outermost to innermost, then by name.

@param left the first scope path.
@param right the second scope path.
@returns the comparison result.
*/
export function compareScopeDepth(left: string, right: string): number {
    const leftDepth = left === '' ? 0 : left.split('/').length;
    const rightDepth = right === '' ? 0 : right.split('/').length;
    return leftDepth - rightDepth || compareText(left, right);
}

/**
Check whether literal include selectors cover a whole project scope.

@param paths the root-relative inclusion and exclusion selectors.
@param scope the project folder, empty for the root.
@returns true only when no exclusion or partial selector leaves scope content active.
*/
export function isScopeCovered(paths: string[], scope: string): boolean {
    if (paths.some((path) => path.startsWith(GLOB_EXCLUDE))) return false;
    if (EVERY_FILE_GLOBS.some((pattern) => paths.includes(pattern))) return true;
    if (scope === '') return false;
    const segments = scope.split('/');
    return segments.some((_, index) => {
        const literal = escapeGlob(segments.slice(0, index + 1).join('/'));
        return paths.includes(literal) || paths.includes(`${literal}${FOLDER_CONTENTS}`);
    });
}

/**
Resolve a scope-relative path within its repository.

@param scope the repository-relative folder.
@param path the scope-relative file.
@returns the repository-relative path.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 56 calls in 39 files share it.
export function joinScope(scope: string, path: string): string {
    return scope === '' ? path : `${scope}/${path}`;
}

/**
Find the project scopes for init and for runs. Leave out the root and tool-only packages.

@param files the repository inventory.
@param dependencyFiles the parsed dependency files.
@param configurations the configurations with project files and npm tools.
@returns project scopes in path order.
*/
export function findScopePaths(
    files: TrackedFile[],
    dependencyFiles: DependencyFile[],
    configurations: Iterable<Configuration>,
): ScopeFolder[] {
    const selected = [...configurations];
    const toolOnlyPackages = listToolOnlyPackages(dependencyFiles, selected);
    const sources = files.filter(
        (file) =>
            file.kind === 'source' &&
            !toolOnlyPackages.has(file.path) &&
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
Find the scope of a file: the deepest scope that contains it, else the root.

@param path the file to place.
@param scopes the scopes to search.
@returns the path of the deepest matching scope, or the empty root path.
*/
export function findScopePath(path: string, scopes: readonly { path: string }[]): string {
    return (
        scopes
            .filter((scope) => scope.path !== '' && isInScope(path, scope.path))
            .toSorted((left, right) => right.path.length - left.path.length)[0]?.path ?? ''
    );
}

/**
Group files by their scope: the deepest scope that contains each file, else the root.

@param files the files to place.
@param scopes the scopes to search.
@returns the files of each scope path, in their order.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 5 calls in 5 files share it.
export function groupFilesByScope<File extends Pick<TrackedFile, 'path'>>(
    files: readonly File[],
    scopes: readonly { path: string }[],
): Map<string, File[]> {
    return Map.groupBy(files, (file) => findScopePath(file.path, scopes));
}

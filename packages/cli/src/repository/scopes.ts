import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { LINT_FOLDERS } from '#cli/config/repository/setup/tools.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import { listToolOnlyPackages } from '#cli/repository/dependencies.ts';
import type { ScopeFolder, TrackedFile } from '#cli/types/repository/files.ts';
import { ROOT_SCOPE, EVERY_FILE_GLOBS } from '#cli/config/repository/scopes.ts';
import type { DependencyFile } from '#cli/types/parsers/projects/dependencies.ts';
import { INSTALLED_DEPENDENCY_FOLDERS } from '#cli/config/repository/files/tracked.ts';
import { GLOB_EXCLUDE, FOLDER_CONTENTS, GLOB_SPECIAL_CHARACTERS } from '#cli/config/files/path-patterns.ts';

/**
 * Test scope containment. The empty root path matches every file.
 *
 * @param path the file to test.
 * @param scope the folder that may contain the file.
 * @returns whether the scope contains the file.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 44 calls in 25 files share it.
export function isInScope(path: string, scope: string): boolean {
    return scope === '' || path === scope || path.startsWith(`${scope}/`);
}

/**
 * Lists the scopes inside another scope, excluding that scope itself.
 *
 * @param paths every scope path.
 * @param scope the parent folder, empty for the repository root.
 * @returns the nested paths in their original order.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 7 calls in 5 files share it.
export function listNestedScopes(paths: readonly string[], scope: string): string[] {
    return paths.filter((path) => path !== scope && isInScope(path, scope));
}

/**
 * Orders scope paths from outermost to innermost, then by name.
 *
 * @param left the first scope path.
 * @param right the second scope path.
 * @returns the comparison result.
 */
export function compareScopeDepth(left: string, right: string): number {
    const leftDepth = left === '' ? 0 : left.split('/').length;
    const rightDepth = right === '' ? 0 : right.split('/').length;
    return leftDepth - rightDepth || left.localeCompare(right);
}

/**
 * Check whether literal include selectors cover a whole project scope.
 *
 * @param paths the root-relative inclusion and exclusion selectors.
 * @param scope the project folder, empty for the root.
 * @returns true only when no exclusion or partial selector leaves scope content active.
 */
export function isScopeCovered(paths: string[], scope: string): boolean {
    if (paths.some((path) => path.startsWith(GLOB_EXCLUDE))) return false;
    if (EVERY_FILE_GLOBS.some((pattern) => paths.includes(pattern))) return true;
    if (scope === '') return false;
    const segments = scope.split('/');
    return segments.some((_, index) => {
        const literal = segments
            .slice(0, index + 1)
            .join('/')
            .replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH);
        return paths.includes(literal) || paths.includes(`${literal}${FOLDER_CONTENTS}`);
    });
}

/**
 * Resolve a scope-relative path within its repository.
 *
 * @param scope the repository-relative folder.
 * @param path the scope-relative file.
 * @returns the repository-relative path.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 56 calls in 39 files share it.
export function joinScope(scope: string, path: string): string {
    return scope === '' ? path : `${scope}/${path}`;
}

/**
 * Find the project scopes for init and for runs. Leave out the root and tool-only packages.
 *
 * @param files the repository inventory.
 * @param dependencyFiles the parsed dependency files.
 * @param configurations the configurations with project files and npm tools.
 * @returns project scopes in path order.
 */
export function findScopeFolders(
    files: TrackedFile[],
    dependencyFiles: DependencyFile[],
    configurations: Iterable<Configuration>,
): ScopeFolder[] {
    const selected = [...configurations];
    const patterns = selected.flatMap((configuration) => configuration.detect.project_files);
    const toolOnlyPackages = listToolOnlyPackages(dependencyFiles, selected);
    const folders = new Set<string>();
    const sources = files.filter(
        (file) =>
            file.kind === 'source' &&
            !toolOnlyPackages.has(file.path) &&
            !(
                file.path.startsWith(`${DOT_GSPOT}/`) ||
                file.path.split('/').some((segment) => INSTALLED_DEPENDENCY_FOLDERS.has(segment))
            ) &&
            !LINT_FOLDERS.some((folder) => file.path.startsWith(`${folder}/`)),
    );
    for (const file of sources) {
        for (const pattern of patterns) {
            const folder = findProjectFolder(file.path, pattern);
            if (folder !== undefined && folder !== '') folders.add(folder);
        }
    }
    return [...folders]
        .toSorted((left, right) => left.localeCompare(right))
        .map((path): ScopeFolder => ({ path, configurations: [], origin: 'project' }));
}

/**
 * Find the folder that a project file marks: the path before the segments that the pattern names.
 *
 * @param path the tracked file, root-relative.
 * @param pattern a project file name, a folder name such as `*.xcodeproj`, or a short path such as `supabase/config.toml`.
 * @returns the project folder, '' for the root, or undefined for other files.
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
 * Find the scope of a file: the deepest scope that contains it, else the root.
 *
 * @param path the file to place.
 * @param scopeFolders the scopes to search.
 * @returns the deepest matching scope, or the root.
 */
export function findScopeFolder(path: string, scopeFolders: ScopeFolder[]): ScopeFolder {
    const root: ScopeFolder = scopeFolders.find((scope) => scope.path === '') ?? { ...ROOT_SCOPE, configurations: [] };
    return (
        scopeFolders
            .filter((scope) => scope.path !== '' && isInScope(path, scope.path))
            .toSorted((left, right) => right.path.length - left.path.length)[0] ?? root
    );
}

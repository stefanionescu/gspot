import { escapeGlob } from '#cli/system/patterns.ts';
import { compareText } from '#cli/system/text/order.ts';
import { findEnclosingFolder } from '#cli/system/paths.ts';
import { GLOB_EXCLUDE, FOLDER_CONTENTS } from '#cli/config/system.ts';
import { ROOT_SCOPE_MARK, EVERY_FILE_GLOBS } from '#cli/config/repository/setup.ts';

const scopeFolderSets = new WeakMap<ReadonlyArray<{ path: string }>, ReadonlySet<string>>();

export function isInScope(path: string, scopePath: string): boolean {
    return scopePath === '' || path === scopePath || path.startsWith(`${scopePath}/`);
}

export function formatScope(path: string): string {
    return path === '' ? ROOT_SCOPE_MARK : path;
}

/**
Format the scope that stands before a check name in a report line. The root scope gets no prefix.
*/
export function formatScopePrefix(path: string): string {
    return path === '' ? '' : `${path}  `;
}

export function listNestedScopes(paths: readonly string[], scopePath: string): string[] {
    return paths.filter((path) => path !== scopePath && isInScope(path, scopePath));
}

export function compareScopeDepth(left: string, right: string): number {
    const leftDepth = left === '' ? 0 : left.split('/').length;
    const rightDepth = right === '' ? 0 : right.split('/').length;
    return leftDepth - rightDepth || compareText(left, right);
}

/**
Check whether literal include selectors cover a whole project scope.

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

export function joinScope(scopePath: string, path: string): string {
    return scopePath === '' ? path : `${scopePath}/${path}`;
}

export function joinScopeGlob(scopePath: string, pattern: string): string {
    return joinScope(escapeGlob(scopePath), pattern);
}

export function isOutsideChildScopes(path: string, children: readonly string[]): boolean {
    return children.every((child) => !isInScope(path, child));
}

export function selectScopePath(path: string, scopes: ReadonlyArray<{ path: string }>): string {
    let folders = scopeFolderSets.get(scopes);
    if (folders === undefined) {
        folders = new Set(scopes.map((scope) => scope.path));
        scopeFolderSets.set(scopes, folders);
    }
    return findEnclosingFolder(path, folders) ?? '';
}

/**
List the files whose deepest enclosing scope is `scopePath`, which leaves out the files of its nested scopes.
*/
export function listOwnFiles<File extends { path: string }>(
    files: readonly File[],
    scopes: ReadonlyArray<{ path: string }>,
    scopePath: string,
): File[] {
    return files.filter((file) => selectScopePath(file.path, scopes) === scopePath);
}

export function selectScope<Entry extends { path: string }>(path: string, scopes: readonly Entry[]): Entry {
    const owner = selectScopePath(path, scopes);
    const scope = scopes.find((each) => each.path === owner);
    if (scope === undefined) throw new Error(`No scope owns ${path}.`);
    return scope;
}

import { relative, resolve } from 'node:path';

import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { EVERY_FILE_GLOBS, LINT_FOLDERS } from '#cli/config/repository/setup.ts';
import { FOLDER_CONTENTS, GLOB_EXCLUDE } from '#cli/config/system.ts';
import { listToolOnlyPackages, listUnparsedDependencyFiles } from '#cli/repository/dependencies.ts';
import { GspotError } from '#cli/system/errors.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import {
    convertToPosixPath,
    escapeGlob,
    findEnclosingFolder,
    isInInstalledFolder,
    isInScope,
    isInside,
} from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { DependencyFile } from '#cli/types/parsers.ts';
import type { ScopeFolder, TrackedFile } from '#cli/types/repository.ts';

const scopeFolderSets = new WeakMap<ReadonlyArray<{ path: string }>, ReadonlySet<string>>();

export function buildArgumentPath(root: string, cwd: string, subject: string): string {
    const path = convertToPosixPath(relative(root, resolve(cwd, subject)));
    if (!isInside(path)) throw new GspotError('arguments', `Path ${subject} is outside this repository.`);
    return path;
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

export function detectScopeFolders(
    files: TrackedFile[],
    dependencyFiles: DependencyFile[],
    configurations: Iterable<Configuration>,
): ScopeFolder[] {
    const selected = [...configurations];
    const toolOnlyPackages = listToolOnlyPackages(dependencyFiles, selected);
    const unparsed = new Set(listUnparsedDependencyFiles(files, dependencyFiles));
    const sources = files.filter(
        (file) =>
            file.kind === 'source' &&
            !toolOnlyPackages.has(file.path) &&
            !unparsed.has(file.path) &&
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

export function selectScope<Entry extends { path: string }>(path: string, scopes: readonly Entry[]): Entry {
    const owner = selectScopePath(path, scopes);
    const scope = scopes.find((each) => each.path === owner);
    if (scope === undefined) throw new Error(`No scope owns ${path}.`);
    return scope;
}

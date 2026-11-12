import { posix } from 'node:path';

import ignore from 'ignore';

import { GITIGNORE_FILE, SKIPPED_PATTERN_STARTS } from '#cli/config/repository/files.ts';
import { GIT_CHECK_IGNORE_ARGUMENTS } from '#cli/config/repository/git.ts';
import { stripBlock } from '#cli/parsers/formats/managed-blocks.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { buildGitError, runGit } from '#cli/repository/git/run.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import { extractParentFolder, isInside } from '#cli/system/paths.ts';
import type { GitignoreMatcher } from '#cli/types/repository.ts';
import type { RunCache } from '#cli/types/system.ts';

/**
Anchor one line of a .gitignore file at the folder of that file. A pattern with a slash before its end is relative to
that folder, and any other pattern matches at any depth below it.
*/
function anchorPattern(line: string, folder: string): string[] {
    const pattern = line.trimEnd();
    if (pattern === '' || pattern.includes('\\') || SKIPPED_PATTERN_STARTS.some((start) => pattern.startsWith(start)))
        return [];
    const body = pattern.startsWith('/') ? pattern.slice(1) : pattern;
    const isAnchored = pattern.slice(0, -1).includes('/');
    if (folder === '') return [isAnchored ? `/${body}` : body];
    return [isAnchored ? `/${folder}/${body}` : `/${folder}/**/${body}`];
}

function isIgnored(path: string, ignores: GitignoreMatcher[]): boolean {
    let isPathIgnored = false;
    for (const { base, matcher } of ignores) {
        if (path === base || !path.startsWith(base)) continue;
        const result = matcher.test(path.slice(base.length));
        if (result.ignored) isPathIgnored = true;
        else if (result.unignored) isPathIgnored = false;
    }
    return isPathIgnored;
}

export function buildGitignoreMatcher(cache: RunCache, trackedPaths: string[]): (path: string) => boolean {
    const ignores: GitignoreMatcher[] = trackedPaths
        .filter((path) => posix.basename(path) === GITIGNORE_FILE)
        .map((file) => {
            const folder = extractParentFolder(file);
            return {
                base: joinScope(folder, ''),
                matcher: ignore().add(readText(cache, file)),
            };
        });
    return (path) => {
        if (!isInside(path)) return false;
        const segments = path.split('/');
        const folders = segments.slice(0, -1).map((_, index) => `${segments.slice(0, index + 1).join('/')}/`);
        return [...folders, path, `${path}/`].some((checkedPath) => isIgnored(checkedPath, ignores));
    };
}

/**
List the patterns of the tracked .gitignore files outside .gspot/, each anchored at the folder of its file. Every clone
tracks the same files, so every clone lists the same patterns. A pattern that matches a tracked file stays out, because
Git checks a tracked file whatever its ignore files say. The block that gspot manages stays out too: an install can
rewrite it, and the generated files must not change with it.
*/
export function listGitignorePatterns(cache: RunCache, trackedPaths: string[]): string[] {
    const patterns = [
        ...new Set(
            trackedPaths
                .filter((path) => posix.basename(path) === GITIGNORE_FILE && !isGspotPath(path))
                .flatMap((file) =>
                    stripBlock(readText(cache, file), file)
                        .split('\n')
                        .flatMap((line) => anchorPattern(line, extractParentFolder(file))),
                ),
        ),
    ];
    const everyPattern = ignore().add(patterns);
    const ignoredPaths = trackedPaths.filter((path) => everyPattern.ignores(path));
    return patterns.filter((pattern) => {
        const matcher = ignore().add(pattern);
        return ignoredPaths.every((path) => !matcher.ignores(path));
    });
}

export async function readIgnoredPaths(root: string, paths: string[], cancelSignal?: AbortSignal): Promise<string[]> {
    if (paths.length === 0) return [];
    const result = await runGit(root, GIT_CHECK_IGNORE_ARGUMENTS, {
        stdin: paths.join('\0') + '\0',
        cancelSignal,
    });
    if (result.code !== 0 && result.code !== 1) throw buildGitError(GIT_CHECK_IGNORE_ARGUMENTS, result);
    return result.stdout.split('\0').filter((path) => path !== '');
}

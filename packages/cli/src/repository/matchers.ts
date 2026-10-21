// Compiles repository path and filename selectors.
import { posix } from 'node:path';
import picomatch from 'picomatch';
import { GLOB_EXCLUDE, TRAILING_SLASH, FOLDER_CONTENTS } from '#cli/config/system/paths.ts';

const matcherCache = new Map<string, (path: string) => boolean>();

/**
 * Build a picomatch matcher for root-relative POSIX paths, cached by pattern list.
 *
 * @param patterns the globs, a leading `!` excludes.
 * @returns a predicate that includes positive globs and rejects excluded paths.
 */
export function buildPathMatcher(patterns: string[]): (path: string) => boolean {
    const key = JSON.stringify(patterns);
    const cached = matcherCache.get(key);
    if (cached) return cached;
    const expanded = includeFolderContents(patterns);
    const includes = expanded
        .filter((pattern) => !pattern.startsWith(GLOB_EXCLUDE))
        .map((pattern) => new RegExp(picomatch.makeRe(pattern, { dot: true }).source, 's'));
    const excludes = expanded
        .filter((pattern) => pattern.startsWith(GLOB_EXCLUDE))
        .map((pattern) => new RegExp(picomatch.makeRe(pattern.slice(1), { dot: true }).source, 's'));
    const isMatch = (path: string): boolean =>
        includes.some((pattern) => pattern.test(path)) && !excludes.some((pattern) => pattern.test(path));
    matcherCache.set(key, isMatch);
    return isMatch;
}

/**
 * Expand literal folder selectors, and keep each include or exclude.
 *
 * @param patterns the selectors, a leading ! for an exclusion.
 * @returns the selectors, each literal path followed by everything under it.
 */
export function includeFolderContents(patterns: string[]): string[] {
    return patterns.flatMap((pattern) => {
        const bare = pattern.startsWith(GLOB_EXCLUDE) ? pattern.slice(1) : pattern;
        return picomatch.scan(bare).isGlob
            ? [pattern]
            : [pattern, `${pattern.replace(TRAILING_SLASH, '')}${FOLDER_CONTENTS}`];
    });
}

/**
 * Build a matcher for literal filenames and globs that tests both the filename and the repository path.
 *
 * @param names exact filenames and glob selectors.
 * @returns the filename matcher that detection and ownership share.
 */
export function buildFilenameMatcher(names: string[]): (path: string) => boolean {
    const literals = new Set(names.filter((name) => !picomatch.scan(name).isGlob));
    const globs = buildPathMatcher(names.filter((name) => picomatch.scan(name).isGlob));
    return (path) => {
        const base = posix.basename(path);
        return literals.has(base) || literals.has(path) || globs(base) || globs(path);
    };
}

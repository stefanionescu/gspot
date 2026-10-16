// Compiles repository path and filename selectors.
import { posix } from 'node:path';
import picomatch from 'picomatch';
import type { PathExpressions } from '#cli/types/repository/inventory.ts';
import { GLOB_EXCLUDE, TRAILING_SLASH, FOLDER_CONTENTS, GLOB_SPECIAL_CHARACTERS } from '#cli/config/system/paths.ts';

const matcherCache = new Map<string, (path: string) => boolean>();

/**
 * Compile shared path selectors for the CLI and generated tool files.
 * @param patterns the selectors, a leading ! for an exclusion.
 * @returns the inclusions and exclusions, directories expanded.
 */
function pathExpressions(patterns: string[]): PathExpressions {
    const expanded = includeFolderContents(patterns);
    return {
        includes: expanded
            .filter((pattern) => !pattern.startsWith(GLOB_EXCLUDE))
            .map((pattern) => picomatch.makeRe(pattern, { dot: true }).source),
        excludes: expanded
            .filter((pattern) => pattern.startsWith(GLOB_EXCLUDE))
            .map((pattern) => picomatch.makeRe(pattern.slice(1), { dot: true }).source),
    };
}

/**
 * A picomatch matcher over root-relative posix paths, cached by pattern list.
 * @param patterns the globs, a leading `!` excludes.
 * @returns the matcher.
 */
export function pathMatcher(patterns: string[]): (path: string) => boolean {
    const key = JSON.stringify(patterns);
    const cached = matcherCache.get(key);
    if (cached) return cached;
    const expressions = pathExpressions(patterns);
    const includes = expressions.includes.map((source) => new RegExp(source, 's'));
    const excludes = expressions.excludes.map((source) => new RegExp(source, 's'));
    const isMatch = (path: string): boolean =>
        includes.some((pattern) => pattern.test(path)) && !excludes.some((pattern) => pattern.test(path));
    matcherCache.set(key, isMatch);
    return isMatch;
}

/**
 * Expand literal directory selectors while retaining their inclusion or exclusion polarity.
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
 * Matches literal filenames and glob selectors against both the filename and repository path.
 * @param names the literal filenames and glob selectors.
 * @returns the same filename matcher for detection and ownership.
 */
export function filenameMatcher(names: string[]): (path: string) => boolean {
    const literals = new Set(names.filter((name) => !picomatch.scan(name).isGlob));
    const globs = pathMatcher(names.filter((name) => picomatch.scan(name).isGlob));
    return (path) => {
        const base = posix.basename(path);
        return literals.has(base) || literals.has(path) || globs(base) || globs(path);
    };
}

/**
 * Escape a repository path so glob selectors match that literal path.
 * @param path the literal repository path.
 * @returns a glob with every special character escaped.
 */
export function literalGlob(path: string): string {
    return path.replaceAll(GLOB_SPECIAL_CHARACTERS, String.raw`\$&`);
}

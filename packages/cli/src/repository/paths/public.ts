import { posix } from 'node:path';
import picomatch from 'picomatch';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import type { PathExpressions } from '#cli/types/repository/inventory.ts';

const matcherCache = new Map<string, (path: string) => boolean>();

/**
 * A picomatch matcher over root-relative posix paths, cached by pattern list.
 * @param patterns the globs, a leading `!` excludes
 * @returns the matcher
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
 * Compile shared path selectors for the CLI and generated tool files.
 * @param patterns the selectors, a leading ! for an exclusion
 * @returns the inclusions and exclusions, directories expanded
 */
export function pathExpressions(patterns: string[]): PathExpressions {
    const expanded = expandedPaths(patterns);
    return {
        includes: expanded
            .filter((pattern) => !pattern.startsWith('!'))
            .map((pattern) => picomatch.makeRe(pattern, { dot: true }).source),
        excludes: expanded
            .filter((pattern) => pattern.startsWith('!'))
            .map((pattern) => picomatch.makeRe(pattern.slice(1), { dot: true }).source),
    };
}

/**
 * True when a file is inside a scope path ('' is the root and matches everything).
 * @param path the file path
 * @param scope the scope path
 * @returns whether the file is in the scope
 */
export function isInScope(path: string, scope: string): boolean {
    return scope === '' || path === scope || path.startsWith(`${scope}/`);
}

/**
 * Lists the scopes inside another scope, excluding that scope itself.
 * @param paths every scope path
 * @param scope the parent scope, empty for the repository root
 * @returns the nested paths in their original order
 */
export function nestedScopes(paths: readonly string[], scope: string): string[] {
    return paths.filter((path) => path !== scope && isInScope(path, scope));
}

/**
 * Orders scope paths from outermost to innermost, then by name.
 * @param left the first scope path
 * @param right the second scope path
 * @returns the comparison result
 */
export function byScopeDepth(left: string, right: string): number {
    const leftDepth = left === '' ? 0 : left.split('/').length;
    const rightDepth = right === '' ? 0 : right.split('/').length;
    return leftDepth - rightDepth || left.localeCompare(right);
}

/**
 * Expand literal directory selectors while retaining their inclusion or exclusion polarity.
 * @param patterns the selectors, a leading ! for an exclusion
 * @returns the selectors, each literal path followed by everything under it
 */
export function expandedPaths(patterns: string[]): string[] {
    return patterns.flatMap((pattern) => {
        const bare = pattern.startsWith('!') ? pattern.slice(1) : pattern;
        return isGlob(bare) ? [pattern] : [pattern, `${pattern.replace(/\/$/u, '')}/**`];
    });
}

/**
 * Determine whether positive literal selectors cover a complete project scope.
 * @param paths the root-relative inclusion and exclusion selectors
 * @param scope the project scope, empty for the root
 * @returns true only when no exclusion or partial selector leaves scope content active
 */
export function coversScope(paths: string[], scope: string): boolean {
    if (paths.some((path) => path.startsWith('!'))) return false;
    if (paths.includes('**') || paths.includes('**/*')) return true;
    if (scope === '') return false;
    const segments = scope.split('/');
    return segments.some((_, index) => {
        const literal = segments
            .slice(0, index + 1)
            .join('/')
            .replaceAll(/[?*[\]{}]/gu, String.raw`\$&`);
        return paths.includes(literal) || paths.includes(`${literal}/**`);
    });
}

/**
 * Determine whether a path belongs to none of the nested project scopes.
 * @param path the repository-relative source or deleted trigger path
 * @param children the nested project scope paths
 * @returns whether the parent scope owns this path
 */
export function isOutsideChildren(path: string, children: string[]): boolean {
    return children.every((child) => !isInScope(path, child));
}

/**
 * Whether a repository path belongs to a gspot tool project.
 * @param path the repository-relative path
 * @returns whether a .gspot folder contains the file
 */
export function isToolProjectPath(path: string): boolean {
    return path.split('/').some((part) => part.toLowerCase() === DOT_GSPOT);
}

/**
 * Whether a repository path belongs to tool projects or installed npm dependencies.
 * @param path the repository-relative path
 * @returns whether project discovery must leave out the path
 */
export function isToolingPath(path: string): boolean {
    return isToolProjectPath(path) || path.split('/').includes('node_modules');
}

/**
 * Whether picomatch interprets a selector as a glob, including brackets and extended globs.
 * @param pattern the authored selector
 * @returns whether the selector has glob syntax
 */
export function isGlob(pattern: string): boolean {
    return picomatch.scan(pattern).isGlob;
}

/**
 * Matches literal filenames and glob selectors against both the filename and repository path.
 * @param names the literal filenames and glob selectors
 * @returns the same filename matcher for detection and ownership
 */
export function filenameMatcher(names: string[]): (path: string) => boolean {
    const literals = new Set(names.filter((name) => !isGlob(name)));
    const globs = pathMatcher(names.filter((name) => isGlob(name)));
    return (path) => {
        const base = posix.basename(path);
        return literals.has(base) || literals.has(path) || globs(base) || globs(path);
    };
}

/**
 * Escape a repository path so native glob selectors match that literal path.
 * @param path the literal repository path
 * @returns a glob with every special character escaped
 */
export function literalGlob(path: string): string {
    return path.replaceAll(/[\\*?{}[\]()!+@,]/gu, String.raw`\$&`);
}

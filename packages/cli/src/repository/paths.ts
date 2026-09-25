import picomatch from 'picomatch';

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
 * Compile the same directory, inclusion, and exclusion selectors for CLI and generated tool configurations.
 * @param patterns
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
 * Expand literal directory selectors while retaining their inclusion or exclusion polarity.
 * @param patterns
 */
export function expandedPaths(patterns: string[]): string[] {
    return patterns.flatMap((pattern) => {
        const bare = pattern.startsWith('!') ? pattern.slice(1) : pattern;
        return picomatch.scan(bare).isGlob ? [pattern] : [pattern, `${pattern.replace(/\/$/u, '')}/**`];
    });
}

export type PathExpressions = { includes: string[]; excludes: string[] };

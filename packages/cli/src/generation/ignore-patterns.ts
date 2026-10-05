import picomatch from 'picomatch';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';

// Expand alternatives before splitting paths because a brace branch can contain a directory separator.
function expandAlternatives(pattern: string): string[] {
    let braceStart = -1;
    let depth = 0;
    const branches: string[] = [];
    let branchStart = 0;
    // Keep escaped characters and character classes out of the brace parser.
    const tokens = pattern.matchAll(/\\[\s\S]|\[(?:\\[\s\S]|[^\]\\])*\]?|[{},]/gu);
    const closing = [...tokens].find((match) => {
        const [character] = match;
        const position = match.index;
        switch (character) {
            case '{': {
                if (depth === 0) {
                    braceStart = position;
                    branchStart = position + 1;
                }
                depth += 1;
                break;
            }
            case ',': {
                if (depth === 1) {
                    branches.push(pattern.slice(branchStart, position));
                    branchStart = position + 1;
                }
                break;
            }
            case '}': {
                if (depth !== 1) {
                    depth = Math.max(0, depth - 1);
                    break;
                }
                branches.push(pattern.slice(branchStart, position));
                return true;
            }
        }
        return false;
    });
    if (closing === undefined) return [pattern];
    return branches.flatMap((entry) =>
        expandAlternatives(`${pattern.slice(0, braceStart)}${entry}${pattern.slice(closing.index + 1)}`),
    );
}

// A globstar can consume no directories or stay active while consuming the scope prefix.
function expandGlobstarSkips(states: Set<number>, parts: string[]): Set<number> {
    const expanded = new Set(states);
    for (const index of expanded) if (parts[index] === '**') expanded.add(index + 1);
    return expanded;
}

function rebaseOntoScope(pattern: string, scope: string): string[] {
    const isDirectoryPattern = pattern.endsWith('/');
    const bare = isDirectoryPattern ? pattern.slice(0, -1) : pattern;
    const isAnchored = bare.startsWith('/') || bare.includes('/');
    const parts = bare.replace(/^\//u, '').split('/');
    if (!isAnchored) parts.unshift('**');
    let states = expandGlobstarSkips(new Set([0]), parts);
    for (const name of scope.split('/')) {
        const next = [...states].flatMap((index) => {
            const part = parts[index];
            if (part === undefined || part === '**') return [index];
            return picomatch.isMatch(name, part, { dot: true, noext: true, nonegate: true }) ? [index + 1] : [];
        });
        states = expandGlobstarSkips(new Set(next), parts);
    }
    if (states.has(parts.length)) return ['/**'];
    return [...states].map((index) => `/${parts.slice(index).join('/')}${isDirectoryPattern ? '/' : ''}`);
}

/**
 * Preserve ordered gitignore patterns when native discovery moves their base into a scope directory.
 * @param patterns the gitignore patterns, relative to the root
 * @param scope the scope path the tool discovers from
 * @returns the patterns relative to the scope
 */
export function scopeIgnorePatterns(patterns: string[], scope: string): string[] {
    if (scope === '') return patterns;
    return patterns.flatMap((pattern) => {
        if (pattern === '' || pattern.startsWith('#')) return [];
        const isNegated = pattern.startsWith('!');
        const bare = isNegated ? pattern.slice(1) : pattern;
        const rebased = expandAlternatives(bare).flatMap((entry) => rebaseOntoScope(entry, scope));
        return [...new Set(rebased)].map((entry) => `${isNegated ? '!' : ''}${entry}`);
    });
}

/**
 * The private tool folders and declared outputs excluded from generated code configurations.
 * @param declarationPaths authored generated and vendored paths
 * @param exclusions additional exclusions of the native configuration
 * @returns ordered repository-relative patterns
 */
export function generatedIgnores(declarationPaths: string[], exclusions: string[]): string[] {
    return ['**/node_modules/**', `${DOT_GSPOT}/**`, ...exclusions, ...declarationPaths];
}

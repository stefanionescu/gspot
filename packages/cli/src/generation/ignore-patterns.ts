import picomatch from 'picomatch';

// Expand alternatives before splitting paths because a brace branch can contain a directory separator.
function alternatives(pattern: string): string[] {
    let start = -1;
    let depth = 0;
    const branches: string[] = [];
    let branch = 0;
    // Keep escaped characters and character classes out of the brace parser.
    const tokens = pattern.matchAll(/\\[\s\S]|\[(?:\\[\s\S]|[^\]\\])*\]?|[{},]/gu);
    const closing = [...tokens].find((match) => {
        const [character] = match;
        const position = match.index;
        switch (character) {
            case '{': {
                if (depth === 0) {
                    start = position;
                    branch = position + 1;
                }
                depth += 1;
                break;
            }
            case ',': {
                if (depth === 1) {
                    branches.push(pattern.slice(branch, position));
                    branch = position + 1;
                }
                break;
            }
            case '}': {
                if (depth !== 1) {
                    depth = Math.max(0, depth - 1);
                    break;
                }
                branches.push(pattern.slice(branch, position));
                return true;
            }
        }
        return false;
    });
    if (closing === undefined) return [pattern];
    return branches.flatMap((entry) =>
        alternatives(`${pattern.slice(0, start)}${entry}${pattern.slice(closing.index + 1)}`),
    );
}

// A globstar can consume no directories or stay active while consuming the scope prefix.
function closure(states: Set<number>, parts: string[]): Set<number> {
    const expanded = new Set(states);
    for (const index of expanded) if (parts[index] === '**') expanded.add(index + 1);
    return expanded;
}

function suffixes(pattern: string, scope: string): string[] {
    const directory = pattern.endsWith('/');
    const bare = directory ? pattern.slice(0, -1) : pattern;
    const anchored = bare.startsWith('/') || bare.includes('/');
    const parts = bare.replace(/^\//u, '').split('/');
    if (!anchored) parts.unshift('**');
    let states = closure(new Set([0]), parts);
    for (const name of scope.split('/')) {
        const next = [...states].flatMap((index) => {
            const part = parts[index];
            if (part === undefined || part === '**') return [index];
            return picomatch.isMatch(name, part, { dot: true, noext: true, nonegate: true }) ? [index + 1] : [];
        });
        states = closure(new Set(next), parts);
    }
    if (states.has(parts.length)) return ['/**'];
    return [...states].map((index) => `/${parts.slice(index).join('/')}${directory ? '/' : ''}`);
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
        const negated = pattern.startsWith('!');
        const bare = negated ? pattern.slice(1) : pattern;
        const projected = alternatives(bare).flatMap((entry) => suffixes(entry, scope));
        return [...new Set(projected)].map((entry) => `${negated ? '!' : ''}${entry}`);
    });
}

import picomatch from 'picomatch';

// Expand alternatives before splitting paths because a brace branch can contain a directory separator.
function alternatives(pattern: string): string[] {
    let start = -1;
    let depth = 0;
    let bracket = false;
    const branches: string[] = [];
    let branch = 0;
    for (let index = 0; index < pattern.length; index += 1) {
        const character = pattern[index];
        if (character === '\\') {
            index += 1;
            continue;
        }
        if (character === '[') bracket = true;
        if (character === ']') bracket = false;
        if (bracket) continue;
        if (character === '{') {
            if (depth === 0) {
                start = index;
                branch = index + 1;
            }
            depth += 1;
        } else if (character === ',' && depth === 1) {
            branches.push(pattern.slice(branch, index));
            branch = index + 1;
        } else if (character === '}' && depth > 0) {
            depth -= 1;
            if (depth === 0) {
                branches.push(pattern.slice(branch, index));
                return branches.flatMap((entry) =>
                    alternatives(`${pattern.slice(0, start)}${entry}${pattern.slice(index + 1)}`),
                );
            }
        }
    }
    return [pattern];
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
        const next = new Set<number>();
        for (const index of states) {
            const part = parts[index];
            if (part === undefined || part === '**') next.add(index);
            else if (picomatch.isMatch(name, part, { dot: true, noext: true, nonegate: true })) next.add(index + 1);
        }
        states = closure(next, parts);
    }
    if (states.has(parts.length)) return ['/**'];
    return [...states].map((index) => `/${parts.slice(index).join('/')}${directory ? '/' : ''}`);
}

/**
 * Preserve ordered gitignore patterns when native discovery moves their base into a scope directory.
 * @param patterns
 * @param scope
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

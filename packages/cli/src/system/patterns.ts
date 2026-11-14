import { posix } from 'node:path';
import picomatch from 'picomatch';

import {
    GLOB_EXCLUDE,
    GLOB_EXCLUSION,
    TRAILING_SLASH,
    FOLDER_CONTENTS,
    GLOB_SPECIAL_CHARACTERS,
    REGEXP_SYNTAX_CHARACTERS,
} from '#cli/config/system.ts';

const matcherCache = new Map<string, (path: string) => boolean>();

export function buildPathMatcher(patterns: string[]): (path: string) => boolean {
    const key = JSON.stringify(patterns);
    const cached = matcherCache.get(key);
    if (cached) return cached;
    const included = includeFolderContents(patterns);
    const includes = included
        .filter((pattern) => !GLOB_EXCLUSION.test(pattern))
        .map((pattern) => new RegExp(picomatch.makeRe(pattern, { dot: true }).source, 's'));
    const excludes = included
        .filter((pattern) => GLOB_EXCLUSION.test(pattern))
        .map((pattern) => new RegExp(picomatch.makeRe(pattern.slice(1), { dot: true }).source, 's'));
    const isMatch = (path: string): boolean =>
        includes.some((pattern) => pattern.test(path)) && excludes.every((pattern) => !pattern.test(path));
    matcherCache.set(key, isMatch);
    return isMatch;
}

export function includeFolderContents(patterns: string[]): string[] {
    return patterns.flatMap((pattern) => {
        const bare = pattern.startsWith(GLOB_EXCLUDE) ? pattern.slice(1) : pattern;
        return picomatch.scan(bare).isGlob
            ? [pattern]
            : [pattern, `${pattern.replace(TRAILING_SLASH, '')}${FOLDER_CONTENTS}`];
    });
}

export function buildFilenameMatcher(names: string[]): (path: string) => boolean {
    const literals = new Set(names.filter((name) => !picomatch.scan(name).isGlob));
    const isGlobMatch = buildPathMatcher(names.filter((name) => picomatch.scan(name).isGlob));
    return (path) => {
        const base = posix.basename(path);
        return literals.has(base) || literals.has(path) || isGlobMatch(base) || isGlobMatch(path);
    };
}

export function escapeGlob(path: string): string {
    return path.replaceAll(GLOB_SPECIAL_CHARACTERS, (match) => `\\${match}`);
}

export function escapeRegExp(text: string): string {
    return text.replaceAll(REGEXP_SYNTAX_CHARACTERS, String.raw`\$&`);
}

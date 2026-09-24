// Which selected configuration claims which file, per scope.
import picomatch from 'picomatch';
import { sourceConfigurations } from '#cli/configurations/select.ts';
import type { PathExpressions, TrackedFile } from '#cli/types/repository.ts';
import type { Claims, Manifest } from '#cli/types/configurations.ts';
import { baseName, extensionOf } from '#cli/platform/paths.ts';

const GLOB_CHARS = /[*?{]/u;

const matcherCache = new Map<string, (path: string) => boolean>();

function isFilenameClaimed(claims: Claims, base: string): boolean {
    if (claims.filenames.length === 0) return false;
    if (claims.filenames.some((name) => !GLOB_CHARS.test(name) && name === base)) return true;
    const globs = claims.filenames.filter((name) => GLOB_CHARS.test(name));
    return globs.length > 0 && pathMatcher(globs)(base);
}

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

/** Compile the same directory, inclusion, and exclusion selectors for CLI and generated tool configurations. */
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
 * True when the claims name this file, by extension, filename at any depth, tag or path glob.
 * @param claims the claims table
 * @param file the file
 * @returns whether the claims cover the file
 */
export function isClaimed(claims: Claims, file: TrackedFile): boolean {
    if (claims.extensions.includes(extensionOf(file.path))) return true;
    if (isFilenameClaimed(claims, baseName(file.path))) return true;
    if (claims.tags.some((tag) => file.tags.includes(tag))) return true;
    return claims.paths.length > 0 && pathMatcher(claims.paths)(file.path);
}

/**
 * The files a claims table names in a scope, honoring its natures and from_languages.
 * @param claims the claims table
 * @param selected the selected manifests, for from_languages
 * @param files the tracked files
 * @param scope the scope path
 * @returns the files claimed
 */
export function claimedByClaims(
    claims: Claims,
    selected: Manifest[],
    files: TrackedFile[],
    scope: string,
): TrackedFile[] {
    const candidates = files.filter((file) => isInScope(file.path, scope) && claims.natures.includes(file.nature));
    if (claims.from_languages) {
        const languages = sourceConfigurations(selected);
        return candidates.filter(
            (file) => isClaimed(claims, file) || languages.some((language) => isClaimed(language.claims, file)),
        );
    }
    return candidates.filter((file) => isClaimed(claims, file));
}

/**
 * Every configuration that claims a file, from the selection.
 * @param file the file
 * @param selected the selected manifests
 * @returns the claimants
 */
export function claimants(file: TrackedFile, selected: Manifest[]): Manifest[] {
    const languages = sourceConfigurations(selected);
    return selected.filter((manifest) => {
        if (manifest.claims.from_languages)
            return isClaimed(manifest.claims, file) || languages.some((language) => isClaimed(language.claims, file));
        return isClaimed(manifest.claims, file);
    });
}

/** Expand literal directory selectors while retaining their inclusion or exclusion polarity. */
export function expandedPaths(patterns: string[]): string[] {
    return patterns.flatMap((pattern) => {
        const bare = pattern.startsWith('!') ? pattern.slice(1) : pattern;
        return picomatch.scan(bare).isGlob ? [pattern] : [pattern, `${pattern.replace(/\/$/u, '')}/**`];
    });
}

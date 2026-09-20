// Which selected preset claims which file, per scope.
import picomatch from 'picomatch';
import { sourcePresets } from '#cli/presets/select.ts';
import type { TrackedFile } from '#types/repository.ts';
import type { Claims, Manifest } from '#types/manifest.ts';
import { baseName, extensionOf } from '#cli/platform/paths.ts';

const GLOB_CHARS = /[*?{]/u;
const isNoMatch = (): boolean => false;

const matcherCache = new Map<string, (path: string) => boolean>();

function isExtensionClaimed(claims: Claims, extension: string): boolean {
    return claims.extensions.includes(extension);
}

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
    const key = patterns.join('\n');
    const cached = matcherCache.get(key);
    if (cached) return cached;
    const includes = patterns.filter((pattern) => !pattern.startsWith('!'));
    const excludes = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
    const isIncluded = includes.length > 0 ? picomatch(includes, { dot: true }) : isNoMatch;
    const isExcluded = excludes.length > 0 ? picomatch(excludes, { dot: true }) : isNoMatch;
    const isMatch = (path: string): boolean => isIncluded(path) && !isExcluded(path);
    matcherCache.set(key, isMatch);
    return isMatch;
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
    if (isExtensionClaimed(claims, extensionOf(file.path))) return true;
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
        const languages = sourcePresets(selected);
        return candidates.filter((file) => languages.some((language) => isClaimed(language.claims, file)));
    }
    return candidates.filter((file) => isClaimed(claims, file));
}

/**
 * The files a preset claims in a scope. A repository preset with from_languages claims what the language and framework presets claim.
 * @param manifest the preset
 * @param selected the selected manifests
 * @param files the tracked files
 * @param scope the scope path
 * @returns the files claimed
 */
export function claimedFiles(
    manifest: Manifest,
    selected: Manifest[],
    files: TrackedFile[],
    scope: string,
): TrackedFile[] {
    return claimedByClaims(manifest.claims, selected, files, scope);
}

/**
 * Every preset that claims a file, from the selection.
 * @param file the file
 * @param selected the selected manifests
 * @returns the claimants
 */
export function claimants(file: TrackedFile, selected: Manifest[]): Manifest[] {
    const languages = sourcePresets(selected);
    return selected.filter((manifest) => {
        if (manifest.claims.from_languages) return languages.some((language) => isClaimed(language.claims, file));
        return isClaimed(manifest.claims, file);
    });
}

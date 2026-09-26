import { baseName, extensionOf } from '#cli/platform/paths.ts';
// Which selected configuration claims which file, per scope.
import { isInScope, pathMatcher } from '#cli/repository/paths.ts';
import type { Claims, Manifest } from '#cli/types/configurations.ts';
import { sourceConfigurations } from '#cli/configurations/select.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';

const GLOB_CHARS = /[*?{]/u;

function isFilenameClaimed(claims: Claims, base: string): boolean {
    if (claims.filenames.length === 0) return false;
    if (claims.filenames.some((name) => !GLOB_CHARS.test(name) && name === base)) return true;
    const globs = claims.filenames.filter((name) => GLOB_CHARS.test(name));
    return globs.length > 0 && pathMatcher(globs)(base);
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

// Which selected preset claims which file, per scope.
import picomatch from 'picomatch';

import { baseName, extensionOf } from '#cli/platform/paths.ts';
import { languagePresets } from '#cli/presets/select.ts';
import type { Claims, Manifest } from '#types/manifest.ts';
import type { TrackedFile } from '#types/repository.ts';

const matcherCache = new Map<string, (path: string) => boolean>();

/** A picomatch matcher over root-relative posix paths, cached by pattern list. */
export function pathMatcher(patterns: string[]): (path: string) => boolean {
    const key = patterns.join('\n');
    const cached = matcherCache.get(key);
    if (cached) return cached;
    const includes = patterns.filter((pattern) => !pattern.startsWith('!'));
    const excludes = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));
    const include = includes.length > 0 ? picomatch(includes, { dot: true }) : () => false;
    const exclude = excludes.length > 0 ? picomatch(excludes, { dot: true }) : () => false;
    const matcher = (path: string) => include(path) && !exclude(path);
    matcherCache.set(key, matcher);
    return matcher;
}

/** True when a file is inside a scope path ('' is the root and matches everything). */
export function inScope(path: string, scope: string): boolean {
    return scope === '' || path === scope || path.startsWith(`${scope}/`);
}

/** True when the claims name this file, by extension, filename at any depth, tag or path glob. */
export function claimsFile(claims: Claims, file: TrackedFile): boolean {
    const ext = extensionOf(file.path);
    if (
        claims.extensions.some(
            (claimed) => claimed === ext || (ext.startsWith('.d.') && claimed === '.d.ts' && ext === '.d.ts'),
        )
    )
        return true;
    const base = baseName(file.path);
    if (claims.filenames.length > 0) {
        const literal = claims.filenames.filter((name) => !/[*?{]/.test(name));
        const globs = claims.filenames.filter((name) => /[*?{]/.test(name));
        if (literal.includes(base)) return true;
        if (globs.length > 0 && pathMatcher(globs)(base)) return true;
    }
    if (claims.tags.some((tag) => file.tags.includes(tag))) return true;
    if (claims.paths.length > 0 && pathMatcher(claims.paths)(file.path)) return true;
    return false;
}

/** The files a preset claims in a scope. A repository preset with from_languages claims what the language presets claim. */
export function claimedFiles(
    manifest: Manifest,
    selected: Manifest[],
    files: TrackedFile[],
    scope: string,
): TrackedFile[] {
    return claimedByClaims(manifest.claims, selected, files, scope);
}

/** The files a claims table names in a scope, honoring its natures and from_languages. */
export function claimedByClaims(
    claims: Claims,
    selected: Manifest[],
    files: TrackedFile[],
    scope: string,
): TrackedFile[] {
    const scoped = files.filter((file) => inScope(file.path, scope) && claims.natures.includes(file.nature));
    if (claims.from_languages) {
        const languages = languagePresets(selected);
        return scoped.filter((file) => languages.some((language) => claimsFile(language.claims, file)));
    }
    return scoped.filter((file) => claimsFile(claims, file));
}

/** Every preset that claims a file, from the selection. */
export function claimants(file: TrackedFile, selected: Manifest[]): Manifest[] {
    const languages = languagePresets(selected);
    return selected.filter((manifest) => {
        if (manifest.claims.from_languages) return languages.some((language) => claimsFile(language.claims, file));
        return claimsFile(manifest.claims, file);
    });
}

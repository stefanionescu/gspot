// Which selected kit owns which file, per scope.
import { posix } from 'node:path';
import { GLOB_CHARS } from '#cli/config/kits.ts';
import { sourceKits } from '#cli/kits/select.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import type { Owners, Manifest } from '#cli/types/kits.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';

function isFilenameClaimed(owners: Owners, base: string): boolean {
    if (owners.filenames.length === 0) return false;
    if (owners.filenames.some((name) => !GLOB_CHARS.test(name) && name === base)) return true;
    const globs = owners.filenames.filter((name) => GLOB_CHARS.test(name));
    return globs.length > 0 && pathMatcher(globs)(base);
}

// The owners with the file types of the selected Prettier plugins, when the table takes them.
function effectiveOwners(owners: Owners, selected: Manifest[]): Owners {
    if (!owners.prettier_plugins) return owners;
    const extensions = selected
        .flatMap((manifest) => manifest.tools)
        .flatMap((tool) => tool.prettier?.extensions ?? []);
    return { ...owners, extensions: [...owners.extensions, ...extensions] };
}

/**
 * True when the owners name this file, by extension, filename at any depth, tag, or path glob.
 * @param owners the owners table
 * @param file the file
 * @returns whether the owners cover the file
 */
export function isOwned(owners: Owners, file: TrackedFile): boolean {
    if (owners.extensions.includes(extensionOf(file.path))) return true;
    if (isFilenameClaimed(owners, posix.basename(file.path))) return true;
    if (owners.tags.some((tag) => file.tags.includes(tag))) return true;
    return owners.paths.length > 0 && pathMatcher(owners.paths)(file.path);
}

/**
 * The files selected by a scoped owners table and its `kinds` and `languages` constraints.
 * @param table the owners table
 * @param selected the selected manifests, for languages and the Prettier plugins
 * @param files the tracked files
 * @param scope the scope path
 * @returns the files owned
 */
export function ownedBy(table: Owners, selected: Manifest[], files: TrackedFile[], scope: string): TrackedFile[] {
    const owners = effectiveOwners(table, selected);
    const candidates = files.filter((file) => isInScope(file.path, scope) && owners.kinds.includes(file.kind));
    if (owners.languages) {
        const languages = sourceKits(selected);
        return candidates.filter(
            (file) => isOwned(owners, file) || languages.some((language) => isOwned(language.files, file)),
        );
    }
    return candidates.filter((file) => isOwned(owners, file));
}

/**
 * Every kit that owners a file, from the selection.
 * @param file the file
 * @param selected the selected manifests
 * @returns the ownerOf
 */
export function ownerOf(file: TrackedFile, selected: Manifest[]): Manifest[] {
    const languages = sourceKits(selected);
    return selected.filter((manifest) => {
        const owners = effectiveOwners(manifest.files, selected);
        if (owners.languages)
            return isOwned(owners, file) || languages.some((language) => isOwned(language.files, file));
        return isOwned(owners, file);
    });
}

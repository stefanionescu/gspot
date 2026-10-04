// Which selected configuration owns which file, per scope.
import { extensionOf } from '#cli/platform/paths.ts';
import { sourceConfigurations } from '#cli/configurations/select.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { Manifest, FileMatch } from '#cli/types/configurations.ts';
import { isInScope, pathMatcher, filenameMatcher } from '#cli/repository/selectors.ts';

// The owners with the file types of the selected Prettier or ESLint plugins, when the table takes them.
function effectiveOwners(owners: FileMatch, selected: Manifest[]): FileMatch {
    if (!owners.prettier_plugins && !owners.eslint_plugins) return owners;
    const extensions = selected
        .flatMap((manifest) => manifest.tools)
        .flatMap((tool) => [
            ...(owners.prettier_plugins ? (tool.prettier?.extensions ?? []) : []),
            ...(owners.eslint_plugins ? (tool.eslint?.extensions ?? []) : []),
        ]);
    return { ...owners, extensions: [...owners.extensions, ...extensions] };
}

/**
 * True when the owners name this file, by extension, filename at any depth, tag, or path glob.
 * @param owners the owners table
 * @param file the file
 * @returns whether the owners cover the file
 */
export function isOwned(owners: FileMatch, file: TrackedFile): boolean {
    if (owners.extensions.includes(extensionOf(file.path))) return true;
    if (filenameMatcher(owners.filenames)(file.path)) return true;
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
export function ownedBy(table: FileMatch, selected: Manifest[], files: TrackedFile[], scope: string): TrackedFile[] {
    const owners = effectiveOwners(table, selected);
    const candidates = files.filter((file) => isInScope(file.path, scope) && owners.kinds.includes(file.kind));
    if (owners.languages) {
        const languages = sourceConfigurations(selected);
        return candidates.filter(
            (file) => isOwned(owners, file) || languages.some((language) => isOwned(language.files, file)),
        );
    }
    return candidates.filter((file) => isOwned(owners, file));
}

/**
 * Every selected configuration that owns a file.
 * @param file the file
 * @param selected the selected manifests
 * @returns the owning configurations
 */
export function ownersOf(file: TrackedFile, selected: Manifest[]): Manifest[] {
    return selected.filter((manifest) => ownedBy(manifest.files, selected, [file], '').length > 0);
}

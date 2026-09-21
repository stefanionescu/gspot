import { LIFECYCLE_PRIVATE_PATH } from '#config/patterns.ts';
// Builds the Repository record: the file set with natures and tags, and the scopes.
import { tagEntry } from '#cli/repository/tags.ts';
import type { FileDeclaration } from '#types/config.ts';
import { FILE_PREFIX_BYTES } from '#config/file-tags.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { policyScopes } from '#cli/repository/scopes.ts';
import type { Repository, TrackedFile } from '#types/repository.ts';
import { natureOf, readAttributes } from '#cli/repository/natures.ts';
import { isGitRepository, trackedEntries, readPrefix } from '#cli/repository/tracked.ts';

/**
 * Reads the tree once: every tracked or about-to-be-tracked file with its nature and tags.
 * @param root the repository root
 * @param declarations the generated and vendored declarations
 * @param scopeEntries the [[scope]] entries
 * @param exclude paths and directory patterns excluded before reading content
 * @returns the repository record
 */
export async function readRepository(
    root: string,
    declarations: FileDeclaration[],
    scopeEntries: { path: string; presets: string[] }[],
    exclude: string[],
): Promise<Repository> {
    const entries = await trackedEntries(root);
    const files: TrackedFile[] = [];
    const isExcluded = pathMatcher(exclude);
    const attributes = readAttributes(root);
    for (const entry of entries) {
        if (LIFECYCLE_PRIVATE_PATH.test(entry.path.normalize('NFC')) || isExcluded(entry.path)) continue;
        const prefix = entry.symlink ? Buffer.alloc(0) : readPrefix(root, entry.path, FILE_PREFIX_BYTES);
        const tagged = tagEntry(entry, prefix);
        const verdict = natureOf(entry.path, declarations, tagged.binary, prefix, attributes);
        const file: TrackedFile = {
            path: entry.path,
            prefix,
            nature: verdict.nature,
            natureSource: verdict.source,
            tags: tagged.tags,
            executable: entry.executable,
            size: entry.size,
        };
        if (verdict.producedBy !== undefined) file.producedBy = verdict.producedBy;
        files.push(file);
    }
    return { root, attributes, hasGit: isGitRepository(root), files, scopes: policyScopes(scopeEntries) };
}

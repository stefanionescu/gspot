// Builds the Repository record: the file set with natures and tags, and the scopes.
import { tagEntry } from '#cli/repository/tags.ts';
import { natureOf } from '#cli/repository/natures.ts';
import { policyScopes } from '#cli/repository/scopes.ts';
import { isGitRepository, trackedEntries } from '#cli/repository/tracked.ts';
import type { DeclareEntry } from '#types/config.ts';
import type { Repository, TrackedFile } from '#types/repository.ts';

/** Reads the tree once: every tracked or would-be-tracked file with its nature and tags. */
export async function readRepository(
    root: string,
    declares: DeclareEntry[],
    scopeEntries: { path: string; presets: string[] }[],
): Promise<Repository> {
    const entries = await trackedEntries(root);
    const files: TrackedFile[] = [];
    for (const entry of entries) {
        const tagged = tagEntry(root, entry);
        const verdict = natureOf(root, entry.path, declares, tagged.binary, tagged.tags.includes('text'));
        const file: TrackedFile = {
            path: entry.path,
            nature: verdict.nature,
            natureSource: verdict.source,
            tags: tagged.tags,
            executable: entry.executable,
            size: entry.size,
        };
        if (verdict.producedBy !== undefined) file.producedBy = verdict.producedBy;
        files.push(file);
    }
    return { root, hasGit: isGitRepository(root), files, scopes: policyScopes(scopeEntries) };
}

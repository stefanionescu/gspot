// Builds the Repository record: the file set with natures and tags, and the scopes.
import { tagEntry } from '#cli/repository/tags.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import type { FileDeclaration } from '#cli/policy/types.ts';
import { FILE_PREFIX_BYTES } from '#cli/repository/file-tags-definitions.ts';
import { policyScopes } from '#cli/repository/scopes.ts';
import type { Repository, TrackedFile } from '#cli/repository/types.ts';
import { natureOf, readAttributes } from '#cli/repository/natures.ts';
import { isGitRepository, trackedEntries, readPrefix, readSource } from '#cli/repository/tracked.ts';
import { swiftTestTags } from '#cli/repository/swift-tests.ts';

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
    const entries = await trackedEntries(root, exclude);
    const files: TrackedFile[] = [];
    const attributes = readAttributes(root);
    const runtimeFiles = new Set(
        readOwnership(root)
            .files.filter((entry) => entry.kind === 'runtime')
            .map((entry) => entry.path),
    );
    for (const entry of entries) {
        const prefix = entry.symlink ? Buffer.alloc(0) : readPrefix(root, entry.path, FILE_PREFIX_BYTES);
        const tagged = tagEntry(entry, prefix);
        const verdict = runtimeFiles.has(entry.path)
            ? { nature: 'generated' as const, source: 'gspot', producedBy: 'gspot check' }
            : natureOf(entry.path, declarations, tagged.binary, prefix, attributes);
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
        if (!entry.symlink && file.nature === 'source' && file.path.endsWith('.swift')) {
            const tags = await swiftTestTags(readSource(root, file.path).toString('utf8'));
            file.tags.push(
                ...tags.filter((tag) => tag !== 'swift-test-target' || file.path.split('/').at(-1) === 'Package.swift'),
            );
        }
        files.push(file);
    }
    return { root, attributes, hasGit: isGitRepository(root), files, scopes: policyScopes(scopeEntries) };
}

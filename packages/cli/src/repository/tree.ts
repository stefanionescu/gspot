// Builds the Repository record: the file set with natures and tags, and the scopes.
import { tagEntry } from '#cli/repository/tags.ts';
import { policyScopes } from '#cli/repository/scopes.ts';
import { swiftTestTags } from '#cli/repository/swift-tests.ts';
import type { FileDeclaration } from '#cli/types/policy/policy.ts';
import { FILE_PREFIX_BYTES } from '#cli/constants/repository/repository.ts';
import { natureOf, readAttributes } from '#cli/repository/file-classification.ts';
import type { Repository, TrackedFile } from '#cli/types/repository/repository.ts';
import { isGitRepository, trackedEntries, readPrefix, readSource } from '#cli/repository/tracked.ts';

/**
 * Reads the tree once: every tracked or about-to-be-tracked file with its nature and tags.
 * @param root the repository root
 * @param declarations the generated and vendored declarations
 * @param scopeEntries the [[scope]] entries
 * @param exclude paths and directory patterns excluded before reading content
 * @param runtimeFiles journal-owned runtime outputs supplied by command composition
 * @returns the repository record
 */
export async function readRepository(
    root: string,
    declarations: FileDeclaration[],
    scopeEntries: { path: string; configurations: string[] }[],
    exclude: string[],
    runtimeFiles: ReadonlySet<string> = new Set(),
): Promise<Repository> {
    const entries = trackedEntries(root, exclude);
    const files: TrackedFile[] = [];
    const attributes = readAttributes(root);
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

// Builds the Repository record: the file set with natures and tags, and the scopes.
import { tagEntry } from '#cli/repository/tags.ts';
import { swiftSourceTags } from '#cli/repository/swift-source.ts';
import type { FileDeclaration } from '#cli/types/policy/policy.ts';
import { FILE_PREFIX_BYTES } from '#cli/config/repository/repository.ts';
import { natureOf, readAttributes } from '#cli/repository/file-classification.ts';
import { readPrefix, readSource, trackedEntries, isGitRepository } from '#cli/repository/tracked.ts';

import type {
    Tagged,
    RawEntry,
    Repository,
    ScopeEntry,
    TrackedFile,
    NatureVerdict,
} from '#cli/types/repository/repository.ts';

function trackedFile(entry: RawEntry, prefix: Buffer, tagged: Tagged, verdict: NatureVerdict): TrackedFile {
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
    return file;
}

/**
 * Reads the tree once: every tracked or about-to-be-tracked file with its nature and tags.
 * @param root the repository root
 * @param declarations the generated and vendored declarations
 * @param scopeEntries the [[scope]] entries
 * @param exclude paths and directory patterns excluded before reading content
 * @param runtimeFiles log-owned runtime outputs supplied by command composition
 * @returns the repository record
 */
export async function readRepository(
    root: string,
    declarations: FileDeclaration[],
    scopeEntries: { path: string; kits: string[] }[],
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
        const file = trackedFile(entry, prefix, tagged, verdict);
        if (!entry.symlink && file.nature === 'source' && file.path.endsWith('.swift')) {
            const tags = await swiftSourceTags(readSource(root, file.path).toString('utf8'));
            file.tags.push(
                ...tags.filter((tag) => tag !== 'swift-test-target' || file.path.split('/').at(-1) === 'Package.swift'),
            );
        }
        files.push(file);
    }
    return {
        root,
        attributes,
        hasGit: isGitRepository(root),
        files,
        scopes: [
            { name: 'root', path: '', kits: [], source: 'root' },
            ...scopeEntries.map(
                (entry): ScopeEntry => ({
                    name: entry.path.slice(entry.path.lastIndexOf('/') + 1),
                    path: entry.path,
                    kits: entry.kits,
                    source: 'gspot.toml',
                }),
            ),
        ],
    };
}

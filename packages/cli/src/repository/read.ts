// Reads the repository inventory, classifies source files, and records authored scopes.
import { openRoot } from '#cli/platform/root/open.ts';
import { buildScope } from '#cli/repository/scopes.ts';
import { isGitRepository } from '#cli/repository/root.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { kindOf, readAttributes } from '#cli/repository/kind.ts';
import { tagEntry, swiftSourceTags } from '#cli/repository/tags.ts';
import { trackedEntries, readIndexEntries } from '#cli/repository/tracked.ts';
import { readPrefix, readSource, createReadCache } from '#cli/platform/source.ts';
import { ROOT_SCOPE, FILE_PREFIX_BYTES } from '#cli/config/repository/inventory.ts';

import type {
    Tagged,
    Verdict,
    RawEntry,
    Repository,
    ScopeEntry,
    TrackedFile,
    FileDeclaration,
} from '#cli/types/repository/inventory.ts';

function trackedFile(entry: RawEntry, prefix: Buffer, tagged: Tagged, verdict: Verdict): TrackedFile {
    const file: TrackedFile = {
        path: entry.path,
        prefix,
        kind: verdict.kind,
        kindSource: verdict.source,
        tags: tagged.tags,
        executable: entry.executable,
        size: entry.size,
    };
    if (verdict.producedBy !== undefined) file.producedBy = verdict.producedBy;
    return file;
}

/**
 * Reads the tracked file inventory with source kinds, language tags, and authored scopes.
 * @param rootPath the repository root
 * @param declarations the generated and vendored declarations
 * @param scopeEntries the [[scope]] entries
 * @param exclude paths and directory patterns excluded before reading content
 * @param reads the session-owned canonical root and source reads
 * @returns the repository record
 */
export async function readRepository(
    rootPath: string,
    declarations: FileDeclaration[],
    scopeEntries: Pick<ScopeEntry, 'path' | 'configurations'>[],
    exclude: string[],
    reads: ReadCache = createReadCache(rootPath),
): Promise<Repository> {
    const root = reads.root;
    const index = await readIndexEntries(root);
    const entries = await trackedEntries(root, exclude, index);
    using directory = openRoot(root);
    const files: TrackedFile[] = [];
    const hasGit = isGitRepository(root);
    const attributes = readAttributes(
        root,
        entries.map((entry) => entry.path),
        hasGit,
    );
    for (const entry of entries) {
        const prefix = entry.symlink ? Buffer.alloc(0) : readPrefix(root, entry.path, FILE_PREFIX_BYTES, reads);
        const tagged = tagEntry(entry, prefix);
        const verdict = kindOf({ root, entry, isBinary: tagged.binary, prefix }, { declarations, attributes });
        const file = trackedFile(entry, prefix, tagged, verdict);
        if (!entry.symlink && file.kind === 'source' && file.path.endsWith('.swift')) {
            const tags = await swiftSourceTags(readSource(root, file.path, reads).toString('utf8'));
            file.tags.push(
                ...tags.filter((tag) => tag !== 'swift-test-target' || file.path.split('/').at(-1) === 'Package.swift'),
            );
        }
        files.push(file);
    }
    return {
        root,
        attributes,
        index,
        hasGit,
        files,
        scopes: [
            { ...ROOT_SCOPE, configurations: [] },
            ...scopeEntries
                .filter((entry) => directory.stat(entry.path)?.isDirectory() === true)
                .map((entry) =>
                    buildScope({
                        path: entry.path,
                        configurations: entry.configurations,
                        source: POLICY_FILE,
                    }),
                ),
        ],
    };
}

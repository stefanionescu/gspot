// Restoring a file the owner changed: merged fields go back, a managed block is removed, or the original returns.
import { isDeepStrictEqual } from 'node:util';
import { blockSpan } from '#cli/lifecycle/managed-blocks.ts';
import type { FileSnapshot } from '#cli/platform/safe-paths.ts';
import type { OwnershipEntry } from '#cli/lifecycle/journal.ts';
import { currentSnapshot } from '#cli/lifecycle/ownership-proposals.ts';
import { configurationDocument } from '#cli/lifecycle/configuration-document.ts';
import { pruneConfigurationParents } from '#cli/lifecycle/configuration-plan.ts';
import { type FileProposal, identity, type Journal, matches } from '#cli/lifecycle/ownership-journal.ts';

type Configuration = NonNullable<OwnershipEntry['configuration']>;
type Restoration = { next?: FileSnapshot };

// The configuration record whose fields go back, when the file was edited or merged into an authored file.
function fieldRestoration(
    existing: OwnershipEntry,
    current: FileSnapshot | undefined,
): { current: FileSnapshot; configuration: Configuration } | undefined {
    const { configuration } = existing;
    if (current === undefined || configuration === undefined) return undefined;
    const applies =
        configuration.edited ||
        !matches(current, existing.installed) ||
        (existing.original === undefined && !configuration.created);
    return applies ? { current, configuration } : undefined;
}

// Puts the original values back into the merged fields, when the installed values are still in place.
function restoreConfiguration(current: FileSnapshot, configuration: Configuration): FileSnapshot | undefined {
    const text = current.bytes.toString('utf8');
    if (!Buffer.from(text).equals(current.bytes)) return undefined;
    const document = configurationDocument(text, configuration.format);
    for (const field of configuration.fields) {
        if (!isDeepStrictEqual(document.value(field.path), field.installed)) return undefined;
    }
    for (const field of configuration.fields) document.set(field.path, field.original);
    pruneConfigurationParents(document, configuration.parents ?? []);
    return { bytes: Buffer.from(document.text()), mode: current.mode };
}

// Puts back the text a managed block replaced, or undefined when the block was edited away.
function restoreBlock(
    current: FileSnapshot,
    block: NonNullable<OwnershipEntry['block']>,
    hasOriginal: boolean,
): Restoration | undefined {
    const text = current.bytes.toString('utf8');
    if (!Buffer.from(text).equals(current.bytes)) return undefined;
    const span = blockSpan(text, block.style);
    if (span === undefined) return undefined;
    const start = span.start - block.prefix.length;
    if (start < 0 || text.slice(start, span.end) !== block.installed) return undefined;
    const next = text.slice(0, start) + block.original + text.slice(span.end);
    return next === '' && !hasOriginal ? {} : { next: { bytes: Buffer.from(next), mode: current.mode } };
}

// The original bytes the journal backed up when the file was first owned.
function originalSnapshot(
    journal: Journal,
    path: string,
    original: NonNullable<OwnershipEntry['original']>,
): FileSnapshot {
    const saved = journal.confined.read(original.backup);
    if (saved === undefined || identity(saved).hash !== original.hash)
        throw new Error(`Original recovery bytes are missing or changed for ${path}: ${original.backup}`);
    return { bytes: saved.bytes, mode: original.mode, ...(original.isLink ? { isLink: true } : {}) };
}

// The bytes that replace an owned file when it is given back, or {} when it is removed.
function originalRestoration(
    journal: Journal,
    path: string,
    existing: OwnershipEntry,
    current: FileSnapshot | undefined,
    original: FileSnapshot | undefined,
): Restoration | undefined {
    if (current !== undefined && !matches(current, existing.installed)) return undefined;
    const saved = existing.original === undefined ? undefined : originalSnapshot(journal, path, existing.original);
    const next = original ?? saved;
    return next === undefined ? {} : { next };
}

// What a restoration writes, {} for a removal, or undefined when the file must be preserved.
function restorationFor(
    journal: Journal,
    path: string,
    existing: OwnershipEntry,
    current: FileSnapshot | undefined,
    original: FileSnapshot | undefined,
): Restoration | undefined {
    const fields = fieldRestoration(existing, current);
    if (fields !== undefined) {
        const next = restoreConfiguration(fields.current, fields.configuration);
        return next === undefined ? undefined : { next };
    }
    if (current !== undefined && existing.block !== undefined)
        return restoreBlock(current, existing.block, existing.original !== undefined);
    return originalRestoration(journal, path, existing, current, original);
}

/**
 * Proposes giving a file back: merged fields return, a managed block leaves, or the original bytes return.
 * @param journal the open journal
 * @param path the file
 * @param original bytes to restore instead of the recorded original
 * @returns the proposal
 */
export function proposeRestoration(journal: Journal, path: string, original?: FileSnapshot): FileProposal {
    const existing = journal.find(path);
    const current = currentSnapshot(journal, path, existing);
    const base = { path, current, previous: existing };
    if (existing === undefined) return { ...base, status: 'preserved' };
    const restoration = restorationFor(journal, path, existing, current, original);
    if (restoration === undefined) return { ...base, status: 'preserved' };
    return { ...base, ...(restoration.next === undefined ? {} : { next: restoration.next }), status: 'changed' };
}

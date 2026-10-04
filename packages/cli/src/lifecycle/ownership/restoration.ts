// Giving back a file the owner changed: merged fields go back, a managed block leaves, or the file goes unless
// gspot adopted it outside `.gspot`.
import { isDeepStrictEqual } from 'node:util';
import { decodeUtf8 } from '#cli/platform/text.ts';
import type { Read } from '#cli/types/platform/root.ts';
import { blockSpan } from '#cli/platform/managed-blocks.ts';
import { pruneParents } from '#cli/lifecycle/merge/plan.ts';
import { isRecorded } from '#cli/lifecycle/ownership/log.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { openTomlDocument } from '#cli/parsers/toml/document.ts';
import type { Planned, MergeRecord } from '#cli/types/lifecycle/output.ts';
import { getOnDisk, recordedBlockStart } from '#cli/lifecycle/ownership/plans.ts';
import type { Log, Restoration, OwnershipEntry } from '#cli/types/lifecycle/ownership.ts';

// The configuration record whose fields go back, when the file was edited or merged into an authored file.
function restorableRecord(existing: OwnershipEntry, current: Read | undefined): MergeRecord | undefined {
    const { configuration } = existing;
    if (current === undefined || configuration === undefined) return undefined;
    const applies = configuration.edited || !configuration.created || !isRecorded(current, existing.installed);
    return applies ? configuration : undefined;
}

// Puts the original values back into the merged fields, when the installed values are still in place.
function restoreFields(current: Read, configuration: MergeRecord): Read | undefined {
    const text = decodeUtf8(current.bytes);
    if (text === undefined) return undefined;
    const document = openTomlDocument(text);
    for (const field of configuration.fields) {
        if (!isDeepStrictEqual(document.value(field.path), field.installed)) return undefined;
    }
    for (const field of configuration.fields) document.set(field.path, field.original);
    pruneParents(document, configuration.parents ?? []);
    return { bytes: Buffer.from(document.text()), mode: current.mode };
}

// Puts back the text a managed block replaced, or undefined when the block was edited away. A file the block
// created is deleted when nothing else was written to it.
function restoreBlock(current: Read, block: NonNullable<OwnershipEntry['block']>): Restoration | undefined {
    const text = decodeUtf8(current.bytes);
    if (text === undefined) return undefined;
    const span = blockSpan(text, block.style);
    if (span === undefined) return undefined;
    const start = recordedBlockStart(text, span, block);
    if (start === undefined) return undefined;
    const next = text.slice(0, start) + block.original + text.slice(span.end);
    return next === '' && block.created ? {} : { next: { bytes: Buffer.from(next), mode: current.mode } };
}

// What giving back a whole file writes: an adopted file stays as it is, any other is deleted. Only gspot writes under
// `.gspot`, so a file adopted there is generated output and goes like any other.
function fileRestoration(existing: OwnershipEntry, current: Read | undefined): Restoration | undefined {
    if (current !== undefined && !isRecorded(current, existing.installed)) return undefined;
    const isKept = existing.adopted === true && current !== undefined && !existing.path.startsWith(`${DOT_GSPOT}/`);
    return isKept ? { next: current } : {};
}

// What a restoration writes, {} for a removal, or undefined when the file must be preserved.
function getRestoration(existing: OwnershipEntry, current: Read | undefined): Restoration | undefined {
    const record = restorableRecord(existing, current);
    if (current !== undefined && record !== undefined) {
        const next = restoreFields(current, record);
        return next === undefined ? undefined : { next };
    }
    if (current !== undefined && existing.block !== undefined) return restoreBlock(current, existing.block);
    return fileRestoration(existing, current);
}

/**
 * Proposes giving a file back: merged fields return, a managed block leaves, or the file goes unless gspot adopted it
 * outside `.gspot`.
 * @param log the open log
 * @param path the file
 * @returns the plan
 */
export function proposeRestoration(log: Log, path: string): Planned {
    const existing = log.entryFor(path);
    const current = getOnDisk(log, path, existing?.installed);
    const base = { path, before: current, previous: existing };
    if (existing === undefined) return { ...base, status: 'preserved' };
    const restoration = getRestoration(existing, current);
    if (restoration === undefined) return { ...base, status: 'preserved' };
    return { ...base, ...(restoration.next === undefined ? {} : { after: restoration.next }), status: 'changed' };
}

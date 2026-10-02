// Giving back a file the owner changed: merged fields go back, a managed block leaves, or the file goes unless
// gspot adopted it.
import { isDeepStrictEqual } from 'node:util';
import type { Read } from '#cli/types/platform.ts';
import { blockSpan } from '#cli/generation/markers.ts';
import { matches } from '#cli/lifecycle/ownership/log.ts';
import { currentRead } from '#cli/lifecycle/ownership/plans.ts';
import { configurationDocument } from '#cli/lifecycle/configuration/document.ts';
import { pruneConfigurationParents } from '#cli/lifecycle/configuration/plan.ts';

import type {
    Log,
    Planned,
    Restoration,
    OwnershipEntry,
    ConfigurationOwnership,
} from '#cli/types/lifecycle/lifecycle.ts';

// The configuration record whose fields go back, when the file was edited or merged into an authored file.
function fieldRestoration(
    existing: OwnershipEntry,
    current: Read | undefined,
): { current: Read; configuration: ConfigurationOwnership } | undefined {
    const { configuration } = existing;
    if (current === undefined || configuration === undefined) return undefined;
    const applies = configuration.edited || !configuration.created || !matches(current, existing.installed);
    return applies ? { current, configuration } : undefined;
}

// Puts the original values back into the merged fields, when the installed values are still in place.
function restoreConfiguration(current: Read, configuration: ConfigurationOwnership): Read | undefined {
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

// Puts back the text a managed block replaced, or undefined when the block was edited away. A file the block
// created is deleted when nothing else was written to it.
function restoreBlock(current: Read, block: NonNullable<OwnershipEntry['block']>): Restoration | undefined {
    const text = current.bytes.toString('utf8');
    if (!Buffer.from(text).equals(current.bytes)) return undefined;
    const span = blockSpan(text, block.style);
    if (span === undefined) return undefined;
    const start = span.start - block.prefix.length;
    if (start < 0 || text.slice(start, span.end) !== block.installed) return undefined;
    const next = text.slice(0, start) + block.original + text.slice(span.end);
    return next === '' && block.created ? {} : { next: { bytes: Buffer.from(next), mode: current.mode } };
}

// What giving back a whole file writes: an adopted file stays as it is, any other is deleted.
function fileRestoration(existing: OwnershipEntry, current: Read | undefined): Restoration | undefined {
    if (current !== undefined && !matches(current, existing.installed)) return undefined;
    return existing.adopted === true && current !== undefined ? { next: current } : {};
}

// What a restoration writes, {} for a removal, or undefined when the file must be preserved.
function restorationFor(existing: OwnershipEntry, current: Read | undefined): Restoration | undefined {
    const fields = fieldRestoration(existing, current);
    if (fields !== undefined) {
        const next = restoreConfiguration(fields.current, fields.configuration);
        return next === undefined ? undefined : { next };
    }
    if (current !== undefined && existing.block !== undefined) return restoreBlock(current, existing.block);
    return fileRestoration(existing, current);
}

/**
 * Proposes giving a file back: merged fields return, a managed block leaves, or the file goes unless gspot adopted it.
 * @param log the open log
 * @param path the file
 * @returns the plan
 */
export function proposeRestoration(log: Log, path: string): Planned {
    const existing = log.entryFor(path);
    const current = currentRead(log, path, existing);
    const base = { path, current, previous: existing };
    if (existing === undefined) return { ...base, status: 'preserved' };
    const restoration = restorationFor(existing, current);
    if (restoration === undefined) return { ...base, status: 'preserved' };
    return { ...base, ...(restoration.next === undefined ? {} : { next: restoration.next }), status: 'changed' };
}

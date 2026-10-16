import { decodeUtf8 } from '#cli/text.ts';
import { isDeepStrictEqual } from 'node:util';
import { normalizeTables } from '#cli/objects.ts';
import type { ManagedKeys } from '#cli/types/apply.ts';
import { ADOPTED_KINDS } from '#cli/config/ownership.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { identify, isRecorded } from '#cli/ownership/log.ts';
import { sameEntry } from '#cli/system/safe-folder/reads.ts';
import type { FileCopy } from '#cli/types/system/safe-folder.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { hasGeneratedHeader } from '#cli/parsers/generated-header.ts';
import { blockSpan, applyBlock } from '#cli/system/managed-blocks.ts';
import type { BlockSpan, BlockStyle, BlockContext } from '#cli/types/system/managed-blocks.ts';
import { pruneParents, planKeyChanges, openKeysDocument } from '#cli/ownership/managed-keys.ts';

import type {
    FileEdit,
    Identity,
    WritePlan,
    OwnedFile,
    OwnedKind,
    OwnedBlock,
    Restoration,
    OwnershipLog,
    PlannedBlock,
    ReplacementRequest,
} from '#cli/types/ownership.ts';

// Compare authored bytes with the last recorded gspot write.
function isEdited(existing: OwnedFile | undefined, current: FileCopy | undefined): boolean {
    if (existing === undefined) return false;
    if (current === undefined) return false;
    return !isRecorded(current, existing.written);
}

// Preserve an unowned file unless its bytes match or the user authorized replacement.
function isPreservedUnownedReplacement(request: ReplacementRequest, current: FileCopy): boolean {
    const owned = request.path.startsWith(`${DOT_GSPOT}/`) || hasGeneratedHeader(current.bytes.toString('utf8'));
    return !owned && !sameEntry(current, request.next) && request.canReplace !== true;
}

// Whether the current file must stay: an edited owned file without review, or an unowned file without replace.
function isPreservedReplacement(
    request: ReplacementRequest,
    existing: OwnedFile | undefined,
    current: FileCopy | undefined,
): boolean {
    if (current === undefined) return false;
    if (existing === undefined) return isPreservedUnownedReplacement(request, current);
    return (
        isEdited(existing, current) &&
        request.kind !== 'settings' &&
        !(request.canReplace === true && request.expected !== undefined)
    );
}

// The plan that installs the next bytes. Adopt an unrecorded file that already holds the intended bytes.
function planChange(
    path: string,
    current: FileCopy | undefined,
    existing: OwnedFile | undefined,
    next: FileCopy,
    kind: OwnedKind,
): WritePlan & Required<Pick<WritePlan, 'entry'>> {
    const written = identify(next);
    const status = sameEntry(current, next) ? 'unchanged' : 'changed';
    const isAdopted = existing === undefined && status === 'unchanged' && ADOPTED_KINDS.has(kind);
    const entry: OwnedFile = { path, kind, written, ...(isAdopted ? { adopted: true } : {}) };
    return { path, before: current, after: next, entry, status };
}

// The next text and record for an intact recorded block, or undefined after an authored block edit.
function planUpdate(
    text: string,
    span: BlockSpan | undefined,
    recorded: OwnedBlock,
    context: BlockContext,
    body: string,
): PlannedBlock | undefined {
    if (recorded.style !== context.style || span === undefined) return undefined;
    const start = recordedBlockStart(text, span, recorded);
    if (start === undefined) return undefined;
    const installed = recorded.prefix + applyBlock('', body, context);
    return { nextText: text.slice(0, start) + installed + text.slice(span.end), block: { ...recorded, installed } };
}

// The next text and record for a file without a recorded block.
function planInsert(
    text: string,
    current: FileCopy | undefined,
    span: BlockSpan | undefined,
    context: BlockContext,
    body: string,
): PlannedBlock {
    const nextText = applyBlock(text, body, context);
    let prefix = '';
    if (span === undefined && text !== '') prefix = text.endsWith('\n') ? '\n' : '\n\n';
    const original = span === undefined ? '' : text.slice(span.start, span.end);
    const installed = prefix + applyBlock('', body, context);
    return { nextText, block: { style: context.style, installed, original, prefix, created: current === undefined } };
}

// The plan a planned block yields: unchanged when the bytes already stand, otherwise the new record.
function blockPlan(
    path: string,
    current: FileCopy | undefined,
    existing: OwnedFile | undefined,
    planned: PlannedBlock,
): WritePlan {
    const next = { bytes: Buffer.from(planned.nextText), mode: current?.mode ?? OWNER_WRITABLE_FILE };
    if (existing?.block !== undefined && sameEntry(current, next))
        return { path, before: current, status: 'unchanged' };
    const plan = planChange(path, current, existing, next, 'block');
    plan.entry.block = planned.block;
    return plan;
}

// Restore recorded fields after edits or merges into authored files.
function restorableKeys(existing: OwnedFile, current: FileCopy | undefined): ManagedKeys | undefined {
    const { keys } = existing;
    if (current === undefined || keys === undefined) return undefined;
    const applies = keys.edited || !keys.created || !isRecorded(current, existing.written);
    return applies ? keys : undefined;
}

// Puts the original values back into the merged fields, when installed values still match.
function restoreKeys(path: string, current: FileCopy, keys: ManagedKeys): FileCopy | undefined {
    if (decodeUtf8(current.bytes) === undefined) return undefined;
    const document = openKeysDocument(path, current);
    for (const field of keys.fields) {
        if (!isDeepStrictEqual(document.value(field.path), normalizeTables(field.installed))) return undefined;
    }
    for (const field of keys.fields) document.set(field.path, field.original);
    pruneParents(document, keys.parents ?? []);
    return { bytes: Buffer.from(document.text()), mode: current.mode };
}

// Puts back the text a managed block replaced, or undefined after an authored block edit. A file the block
// created gets deleted when it holds no other authored text.
function restoreBlock(
    path: string,
    current: FileCopy,
    block: NonNullable<OwnedFile['block']>,
): Restoration | undefined {
    const text = decodeUtf8(current.bytes);
    if (text === undefined) return undefined;
    const span = blockSpan(text, { path, style: block.style });
    if (span === undefined) return undefined;
    const start = recordedBlockStart(text, span, block);
    if (start === undefined) return undefined;
    const next = text.slice(0, start) + block.original + text.slice(span.end);
    return next === '' && block.created ? {} : { next: { bytes: Buffer.from(next), mode: current.mode } };
}

// What giving back a whole file writes: keep adopted files and delete other files. Only gspot writes under
// `.gspot`, so delete adopted generated files.
function fileRestoration(existing: OwnedFile, current: FileCopy | undefined): Restoration | undefined {
    if (current !== undefined && !isRecorded(current, existing.written)) return undefined;
    const isKept = existing.adopted === true && current !== undefined && !existing.path.startsWith(`${DOT_GSPOT}/`);
    return isKept ? { next: current } : {};
}

// What a restoration writes, {} for a removal, or undefined for a preserved file.
function findRestoration(existing: OwnedFile, current: FileCopy | undefined): Restoration | undefined {
    const record = restorableKeys(existing, current);
    if (current !== undefined && record !== undefined) {
        const next = restoreKeys(existing.path, current, record);
        return next === undefined ? undefined : { next };
    }
    if (current !== undefined && existing.block !== undefined)
        return restoreBlock(existing.path, current, existing.block);
    return fileRestoration(existing, current);
}

/**
 * Read the disk file as a link entry when the plan or record holds a link.
 *
 * @param log the open log.
 * @param path the file.
 * @param sides the current file, the next bytes, or the record.
 *
 * @returns the copy, or undefined when the file does not exist.
 */
function readOnDisk(
    log: OwnershipLog,
    path: string,
    ...sides: (FileCopy | Identity | undefined)[]
): FileCopy | undefined {
    const isLink = sides.some((side) => side?.isLink === true);
    return isLink ? log.files.readKeepingLinks(path) : log.files.read(path);
}

/**
 * Finds the start of a recorded managed block when its text matches.
 *
 * @param text the current file text.
 * @param span the current block limits.
 * @param block the recorded block.
 *
 * @returns the start, or undefined when the block changed.
 */
function recordedBlockStart(text: string, span: BlockSpan, block: OwnedBlock): number | undefined {
    const start = span.start - block.prefix.length;
    return start < 0 || text.slice(start, span.end) !== block.installed ? undefined : start;
}

/**
 * Proposes the next bytes of a file, preserving an edited or unowned file unless the caller takes it over.
 *
 * @param log the open log.
 * @param request the replacement and reviewed file state.
 *
 * @returns the plan.
 */
export function planReplacement(log: OwnershipLog, request: ReplacementRequest): WritePlan {
    const { path, next, kind, expected } = request;
    const existing = log.entryFor(path);
    const current = readOnDisk(log, path, next, existing?.written);
    // Preserve edited owned files unless the caller reviewed their exact bytes and authorized replacement.
    if (isPreservedReplacement(request, existing, current)) return { path, before: current, status: 'preserved' };
    if (existing !== undefined && sameEntry(current, next) && isRecorded(current, existing.written))
        return { path, before: current, status: 'unchanged' };
    return planChange(path, expected ?? current, existing, next, kind);
}

/**
 * Proposes the managed block of a file, preserving authored edits to its recorded block.
 *
 * @param log the open log.
 * @param path the file.
 * @param body the block body.
 * @param style the comment style of the block markers.
 *
 * @returns the plan.
 */
export function planBlock(log: OwnershipLog, path: string, body: string, style: BlockStyle): WritePlan {
    const existing = log.entryFor(path);
    const current = log.files.read(path);
    const text = current === undefined ? '' : decodeUtf8(current.bytes);
    if (text === undefined) throw new Error(`${path} is not UTF-8 text`);
    const context = { path, style };
    const span = blockSpan(text, context);
    const recorded = existing?.block;
    if (recorded !== undefined && current !== undefined) {
        const planned = planUpdate(text, span, recorded, context, body);
        if (planned === undefined) return { path, before: current, status: 'preserved' };
        return blockPlan(path, current, existing, planned);
    }
    if (isEdited(existing, current)) return { path, before: current, status: 'preserved' };
    return blockPlan(path, current, existing, planInsert(text, current, span, context, body));
}

/**
 * Proposes merged fields in an authored tool file.
 *
 * @param log the open log.
 * @param path the file.
 * @param changes the keys and the values they must hold.
 * @param canReplace whether to merge into an unowned file.
 *
 * @returns the plan.
 */
export function planManagedKeys(
    log: OwnershipLog,
    path: string,
    changes: FileEdit['changes'],
    canReplace = false,
): WritePlan {
    const existing = log.entryFor(path);
    const current = log.files.read(path);
    const isInstalled = isRecorded(current, existing?.written);
    const plan = planKeyChanges({
        path,
        changes,
        current,
        existing,
        matchesInstalled: isInstalled,
        canReplace,
    });
    if (plan === undefined) return { path, before: current, status: 'preserved' };
    if (plan.status === 'unchanged' && existing?.keys !== undefined)
        return { path, before: current, status: 'unchanged' };
    const entry: OwnedFile = {
        path,
        kind: 'keys',
        written: identify(plan.next),
        keys: plan.keys,
    };
    return { path, before: current, after: plan.next, entry, status: plan.status };
}

/**
 * Proposes the removal of a file whose bytes the caller reviewed, with its record. Git keeps the bytes.
 *
 * @param log the open log.
 * @param path the file.
 * @param expected the bytes the caller reviewed, which must still match the file.
 *
 * @returns the plan.
 */
export function planDeletion(log: OwnershipLog, path: string, expected: FileCopy): WritePlan {
    const existing = log.entryFor(path);
    const current = log.files.read(path);
    if (!isDeepStrictEqual(current, expected))
        throw new Error(`${path} changed after gspot read it. Run the command again.`);
    if (current === undefined) return { path, before: current, status: 'unchanged' };
    if (existing !== undefined && !isRecorded(current, existing.written))
        return { path, before: current, status: 'preserved' };
    return { path, before: current, status: 'changed' };
}

/**
 * Proposes giving a file back: merged fields return, a managed block leaves, or the file goes unless gspot adopted it
 * outside `.gspot`.
 *
 * @param log the open log.
 * @param path the file.
 *
 * @returns the plan.
 */
export function planRestoration(log: OwnershipLog, path: string): WritePlan {
    const existing = log.entryFor(path);
    const current = readOnDisk(log, path, existing?.written);
    const base = { path, before: current };
    if (existing === undefined) return { ...base, status: 'preserved' };
    const restoration = findRestoration(existing, current);
    if (restoration === undefined) return { ...base, status: 'preserved' };
    return { ...base, ...(restoration.next === undefined ? {} : { after: restoration.next }), status: 'changed' };
}

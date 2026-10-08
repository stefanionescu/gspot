// What the owner proposes for one file: a replacement, a managed block, a merged configuration, or a retirement.
import { isDeepStrictEqual } from 'node:util';
import { decodeUtf8 } from '#cli/platform/text.ts';
import { sameEntry } from '#cli/platform/root/rules.ts';
import type { FileCopy } from '#cli/types/platform/root.ts';
import type { Planned } from '#cli/types/lifecycle/apply.ts';
import { planDocumentMerge } from '#cli/lifecycle/merge/plan.ts';
import { ADOPTED_KINDS } from '#cli/config/lifecycle/ownership.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import type { EmittedToolFile } from '#cli/types/generation/files.ts';
import { identify, isRecorded } from '#cli/lifecycle/ownership/log.ts';
import { blockSpan, applyBlock } from '#cli/platform/managed-blocks.ts';
import type { BlockSpan, BlockStyle, BlockContext } from '#cli/types/platform/managed-blocks.ts';

import type {
    Log,
    Identity,
    OwnedKind,
    OwnedBlock,
    PlannedBlock,
    OwnershipEntry,
    ReplacementRequest,
} from '#cli/types/lifecycle/ownership.ts';

// An authored file is edited when its current bytes differ from the recorded gspot write.
function isEdited(existing: OwnershipEntry | undefined, current: FileCopy | undefined): boolean {
    if (existing === undefined) return false;
    if (current === undefined) return false;
    return !isRecorded(current, existing.installed);
}

// Whether the current file must stay: an edited owned file without review, or an unowned file without replace.
function isPreservedReplacement(
    request: ReplacementRequest,
    existing: OwnershipEntry | undefined,
    current: FileCopy | undefined,
): boolean {
    if (current === undefined) return false;
    if (existing === undefined) return !sameEntry(current, request.next) && request.canReplace !== true;
    return (
        isEdited(existing, current) &&
        request.kind !== 'policy' &&
        !(request.canReplace === true && request.expected !== undefined)
    );
}

// The plan that installs the next bytes. A file gspot first records while it already holds them is adopted.
function planChange(
    path: string,
    current: FileCopy | undefined,
    existing: OwnershipEntry | undefined,
    next: FileCopy,
    kind: OwnedKind,
): Planned & Required<Pick<Planned, 'entry'>> {
    const installed = identify(next);
    const status = sameEntry(current, next) ? 'unchanged' : 'changed';
    const isAdopted = existing === undefined && status === 'unchanged' && ADOPTED_KINDS.has(kind);
    const entry: OwnershipEntry = { path, kind, installed, ...(isAdopted ? { adopted: true } : {}) };
    return { path, before: current, after: next, entry, status };
}

// The next text and record when the recorded block is still in place, or undefined when it was edited away.
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

// The next text and record for a file whose block is not recorded yet.
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
    existing: OwnershipEntry | undefined,
    planned: PlannedBlock,
): Planned {
    const next = { bytes: Buffer.from(planned.nextText), mode: current?.mode ?? OWNER_WRITABLE_FILE };
    if (existing?.block !== undefined && sameEntry(current, next))
        return { path, before: current, status: 'unchanged' };
    const plan = planChange(path, current, existing, next, 'block');
    plan.entry.block = planned.block;
    return plan;
}

/**
 * The file as it is on disk, read as a link entry when any side of the plan or its record is a link.
 * @param log the open log
 * @param path the file
 * @param sides the current file, the next bytes, or the record
 * @returns the copy, or undefined when the file does not exist
 */
export function getOnDisk(log: Log, path: string, ...sides: (FileCopy | Identity | undefined)[]): FileCopy | undefined {
    const isLink = sides.some((side) => side?.isLink === true);
    return isLink ? log.files.readKeepingLinks(path) : log.files.read(path);
}

/**
 * Proposes the next bytes of a file, preserving an edited or unowned file unless the caller takes it over.
 * @param log the open log
 * @param request the replacement and reviewed file state
 * @returns the plan
 */
export function planReplacement(log: Log, request: ReplacementRequest): Planned {
    const { path, next, kind, expected, plannedFiles } = request;
    const existing = log.entryFor(path);
    log.files.validate(path, next, plannedFiles);
    const current = getOnDisk(log, path, next, existing?.installed);
    // An edited owned file is preserved unless the caller reviewed those exact bytes and authorizes the replacement.
    if (isPreservedReplacement(request, existing, current)) return { path, before: current, status: 'preserved' };
    if (existing !== undefined && sameEntry(current, next) && isRecorded(current, existing.installed))
        return { path, before: current, status: 'unchanged' };
    return planChange(path, expected ?? current, existing, next, kind);
}

/**
 * Proposes the managed block of a file, preserving the file when its recorded block was edited away.
 * @param log the open log
 * @param path the file
 * @param body the block body
 * @param style the comment style of the block markers
 * @returns the plan
 */
export function planBlock(log: Log, path: string, body: string, style: BlockStyle): Planned {
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
 * Proposes merged fields in a configuration file the repository authored.
 * @param log the open log
 * @param path the file
 * @param changes the keys and the values they must hold
 * @param canReplace whether an unowned file may be merged into
 * @returns the plan
 */
export function planMerge(log: Log, path: string, changes: EmittedToolFile['changes'], canReplace = false): Planned {
    const existing = log.entryFor(path);
    const current = log.files.read(path);
    const isInstalled = isRecorded(current, existing?.installed);
    const plan = planDocumentMerge({
        path,
        changes,
        current,
        existing,
        matchesInstalled: isInstalled,
        canReplace,
    });
    if (plan === undefined) return { path, before: current, status: 'preserved' };
    if (plan.status === 'unchanged' && existing?.configuration !== undefined)
        return { path, before: current, status: 'unchanged' };
    const entry: OwnershipEntry = {
        path,
        kind: 'merge',
        installed: identify(plan.next),
        configuration: plan.configuration,
    };
    return { path, before: current, after: plan.next, entry, status: plan.status };
}

/**
 * Proposes the removal of a file whose bytes the caller reviewed, with its record. Git keeps the bytes.
 * @param log the open log
 * @param path the file
 * @param expected the bytes the caller reviewed, which must still be the file's
 * @returns the plan
 */
export function planRetirement(log: Log, path: string, expected: FileCopy): Planned {
    const existing = log.entryFor(path);
    const current = log.files.read(path);
    if (!isDeepStrictEqual(current, expected))
        throw new Error(`${path} changed after gspot read it. Run the command again.`);
    if (current === undefined) return { path, before: current, status: 'unchanged' };
    if (existing !== undefined && !isRecorded(current, existing.installed))
        return { path, before: current, status: 'preserved' };
    return { path, before: current, status: 'changed' };
}

/**
 * Finds the start of a recorded managed block when its text is unchanged.
 * @param text the current file text
 * @param span the current block limits
 * @param block the recorded block
 * @returns the start, or undefined when the block changed
 */
export function recordedBlockStart(text: string, span: BlockSpan, block: OwnedBlock): number | undefined {
    const start = span.start - block.prefix.length;
    return start < 0 || text.slice(start, span.end) !== block.installed ? undefined : start;
}

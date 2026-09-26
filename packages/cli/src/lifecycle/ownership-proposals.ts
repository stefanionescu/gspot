// What the owner proposes for one file: a replacement, a managed block, a merged configuration, or a retirement.
import { isDeepStrictEqual } from 'node:util';
import type { FileSnapshot } from '#cli/platform/safe-paths.ts';
import type { OwnershipEntry } from '#cli/lifecycle/journal.ts';
import { OWNER_WRITABLE_FILE } from '#cli/platform/file-modes.ts';
import type { BlockStyle } from '#cli/lifecycle/managed-blocks.ts';
import { applyBlock, blockSpan } from '#cli/lifecycle/managed-blocks.ts';
import { planConfiguration } from '#cli/lifecycle/configuration-plan.ts';
import type { ConfigurationFormat } from '#cli/lifecycle/configuration-document.ts';
import { type FileProposal, identity, type Journal, matches } from '#cli/lifecycle/ownership-journal.ts';

type Block = NonNullable<OwnershipEntry['block']>;
type Span = ReturnType<typeof blockSpan>;
type PlannedBlock = { nextText: string; block: Block };

// Whether the current file must stay: an edited owned file without review, or an unowned file without takeover.
function isPreservedReplacement(
    existing: OwnershipEntry | undefined,
    current: FileSnapshot | undefined,
    installed: ReturnType<typeof identity>,
    kind: OwnershipEntry['kind'],
    takeover: boolean,
    expected: FileSnapshot | undefined,
): boolean {
    if (current === undefined) return false;
    if (existing === undefined) return !matches(current, installed) && !takeover;
    return !matches(current, existing.installed) && kind !== 'policy' && !(takeover && expected !== undefined);
}

// The proposal that installs the next bytes, recording the original the entry already keeps.
function changedReplacement(
    path: string,
    current: FileSnapshot | undefined,
    existing: OwnershipEntry | undefined,
    next: FileSnapshot,
    kind: OwnershipEntry['kind'],
): FileProposal {
    const installed = identity(next);
    const entry: OwnershipEntry = {
        path,
        kind,
        installed,
        ...(existing?.original === undefined ? {} : { original: existing.original }),
    };
    const status = matches(current, installed) ? 'unchanged' : 'changed';
    return {
        path,
        current,
        previous: existing,
        next,
        entry,
        saveOriginal: existing === undefined && current !== undefined,
        status,
    };
}

// The text of a managed block's file, refused when the file is not UTF-8 text.
function blockText(path: string, current: FileSnapshot | undefined): string {
    const text = current?.bytes.toString('utf8') ?? '';
    if (current !== undefined && !Buffer.from(text).equals(current.bytes))
        throw new Error(`Managed block destination is not UTF-8 text: ${path}`);
    return text;
}

// The next text and record when the recorded block is still in place, or undefined when it was edited away.
function updatedBlock(
    text: string,
    span: Span,
    recorded: Block,
    style: BlockStyle,
    body: string,
): PlannedBlock | undefined {
    if (recorded.style !== style || span === undefined) return undefined;
    const start = span.start - recorded.prefix.length;
    if (start < 0 || text.slice(start, span.end) !== recorded.installed) return undefined;
    const installed = recorded.prefix + applyBlock('', body, style);
    return { nextText: text.slice(0, start) + installed + text.slice(span.end), block: { ...recorded, installed } };
}

// The next text and record for a file whose block is not recorded yet.
function insertedBlock(text: string, span: Span, style: BlockStyle, body: string): PlannedBlock {
    const nextText = applyBlock(text, body, style);
    let prefix = '';
    if (span === undefined && text !== '') prefix = text.endsWith('\n') ? '\n' : '\n\n';
    const original = span === undefined ? '' : text.slice(span.start, span.end);
    return { nextText, block: { style, installed: prefix + applyBlock('', body, style), original, prefix } };
}

// The proposal a planned block yields: unchanged when the bytes already stand, otherwise the new record.
function blockProposal(
    path: string,
    current: FileSnapshot | undefined,
    existing: OwnershipEntry | undefined,
    planned: PlannedBlock,
    text: string,
): FileProposal {
    const next = { bytes: Buffer.from(planned.nextText), mode: current?.mode ?? OWNER_WRITABLE_FILE };
    if (existing?.block !== undefined && matches(current, identity(next)))
        return { path, current, previous: existing, status: 'unchanged' };
    const entry: OwnershipEntry = {
        path,
        kind: 'block',
        installed: identity(next),
        block: planned.block,
        ...(existing?.original === undefined ? {} : { original: existing.original }),
    };
    const status = planned.nextText === text ? 'unchanged' : 'changed';
    return {
        path,
        current,
        previous: existing,
        next,
        entry,
        saveOriginal: existing === undefined && current !== undefined,
        status,
    };
}

// The proposal that records a merged configuration file.
function mergeProposal(
    path: string,
    current: FileSnapshot | undefined,
    existing: OwnershipEntry | undefined,
    plan: NonNullable<ReturnType<typeof planConfiguration>>,
): FileProposal {
    const entry: OwnershipEntry = {
        path,
        kind: 'merge',
        installed: identity(plan.next),
        configuration: plan.configuration,
        ...(existing?.original === undefined ? {} : { original: existing.original }),
    };
    const saveOriginal = existing === undefined && current !== undefined;
    return { path, current, previous: existing, next: plan.next, entry, saveOriginal, status: plan.status };
}

// The proposal that retires a file: its record loses the installed identity and keeps the original.
function retirementProposal(path: string, current: FileSnapshot, existing: OwnershipEntry | undefined): FileProposal {
    const kind = existing?.kind ?? 'config';
    const entry: OwnershipEntry = {
        path,
        kind,
        ...(existing?.original === undefined ? {} : { original: existing.original }),
    };
    return { path, current, previous: existing, entry, saveOriginal: existing === undefined, status: 'changed' };
}

/**
 * The file as it is now, read as a link entry when the proposal or the record involves a link.
 * @param journal the open journal
 * @param path the file
 * @param existing the file's record
 * @param next the bytes proposed for it, when a replacement is proposed
 * @returns the snapshot, or undefined when the file does not exist
 */
export function currentSnapshot(
    journal: Journal,
    path: string,
    existing: OwnershipEntry | undefined,
    next?: FileSnapshot,
): FileSnapshot | undefined {
    const isLink = next?.isLink === true || existing?.installed?.isLink === true || existing?.original?.isLink === true;
    if (isLink) return journal.confined.readEntry(path);
    return journal.confined.read(path);
}

/**
 * Proposes the next bytes of a file, preserving an edited or unowned file unless the caller takes it over.
 * @param journal the open journal
 * @param path the file
 * @param next the bytes to install
 * @param kind what the file is to gspot
 * @param takeover whether an unowned or reviewed file may be replaced
 * @param expected the bytes the caller reviewed, which must still be the file's
 * @param proposed the other destinations of the same batch
 * @returns the proposal
 */
export function proposeReplacement(
    journal: Journal,
    path: string,
    next: FileSnapshot,
    kind: OwnershipEntry['kind'],
    takeover = false,
    expected?: FileSnapshot,
    proposed?: ReadonlyMap<string, FileSnapshot | undefined>,
): FileProposal {
    const existing = journal.find(path);
    journal.confined.validate(path, next, proposed);
    const current = currentSnapshot(journal, path, existing, next);
    if (expected !== undefined && !isDeepStrictEqual(current, expected))
        throw new Error(`Configuration changed after takeover was planned: ${path}. Retry the command.`);
    const installed = identity(next);
    // An edited owned file is preserved unless the caller reviewed those very bytes and authorizes the replacement.
    if (isPreservedReplacement(existing, current, installed, kind, takeover, expected))
        return { path, current, previous: existing, status: 'preserved' };
    if (existing !== undefined && matches(current, installed))
        return { path, current, previous: existing, status: 'unchanged' };
    return changedReplacement(path, current, existing, next, kind);
}

/**
 * Proposes the managed block of a file, preserving the file when its recorded block was edited away.
 * @param journal the open journal
 * @param path the file
 * @param body the block body
 * @param style the comment style of the block markers
 * @returns the proposal
 */
export function proposeBlock(journal: Journal, path: string, body: string, style: BlockStyle): FileProposal {
    const existing = journal.find(path);
    const current = journal.confined.read(path);
    const text = blockText(path, current);
    const span = blockSpan(text, style);
    const recorded = existing?.block;
    if (recorded !== undefined && current !== undefined) {
        const planned = updatedBlock(text, span, recorded, style, body);
        if (planned === undefined) return { path, current, previous: existing, status: 'preserved' };
        return blockProposal(path, current, existing, planned, text);
    }
    if (existing !== undefined && current !== undefined && !matches(current, existing.installed))
        return { path, current, previous: existing, status: 'preserved' };
    return blockProposal(path, current, existing, insertedBlock(text, span, style, body), text);
}

/**
 * Proposes merged fields in a configuration file the repository authored.
 * @param journal the open journal
 * @param path the file
 * @param format the file's format
 * @param changes the keys and the values they must hold
 * @param takeover whether an unowned file may be merged into
 * @returns the proposal
 */
export function proposeConfiguration(
    journal: Journal,
    path: string,
    format: ConfigurationFormat,
    changes: { path: (string | number)[]; value: unknown }[],
    takeover = false,
): FileProposal {
    const existing = journal.find(path);
    const current = journal.confined.read(path);
    const isInstalled = matches(current, existing?.installed);
    const plan = planConfiguration(path, format, changes, current, existing, isInstalled, takeover);
    if (plan === undefined) return { path, current, previous: existing, status: 'preserved' };
    if (plan.status === 'unchanged' && existing?.configuration !== undefined)
        return { path, current, previous: existing, status: 'unchanged' };
    return mergeProposal(path, current, existing, plan);
}

/**
 * Proposes the removal of a file whose bytes the caller reviewed.
 * @param journal the open journal
 * @param path the file
 * @param expected the bytes the caller reviewed, which must still be the file's
 * @returns the proposal
 */
export function proposeRetirement(journal: Journal, path: string, expected: FileSnapshot): FileProposal {
    const existing = journal.find(path);
    const current = journal.confined.read(path);
    if (!isDeepStrictEqual(current, expected))
        throw new Error(`Configuration changed after takeover was planned: ${path}. Retry the command.`);
    if (current === undefined) return { path, current, previous: existing, status: 'unchanged' };
    if (existing !== undefined && !matches(current, existing.installed))
        return { path, current, previous: existing, status: 'preserved' };
    return retirementProposal(path, current, existing);
}

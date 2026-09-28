// What the owner proposes for one file: a replacement, a managed block, a merged configuration, or a retirement.
import { isDeepStrictEqual } from 'node:util';
import type { Read } from '#cli/types/platform.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform.ts';
import { matches, identity } from '#cli/lifecycle/ownership/log.ts';
import { blockSpan, applyBlock } from '#cli/lifecycle/managed-blocks.ts';
import { planConfiguration } from '#cli/lifecycle/configuration/plan.ts';

import type {
    Log,
    Planned,
    BlockSpan,
    BlockStyle,
    OwnedBlock,
    PlannedBlock,
    OwnershipEntry,
    ReplacementRequest,
    ConfigurationFormat,
} from '#cli/types/lifecycle/lifecycle.ts';

// Whether the current file must stay: an edited owned file without review, or an unowned file without replace.
function isPreservedReplacement(
    existing: OwnershipEntry | undefined,
    current: Read | undefined,
    installed: ReturnType<typeof identity>,
    kind: OwnershipEntry['kind'],
    replace: boolean,
    expected: Read | undefined,
): boolean {
    if (current === undefined) return false;
    if (existing === undefined) return !matches(current, installed) && !replace;
    return !matches(current, existing.installed) && kind !== 'policy' && !(replace && expected !== undefined);
}

// The plan that installs the next bytes, recording the original the entry already keeps.
function changedReplacement(
    path: string,
    current: Read | undefined,
    existing: OwnershipEntry | undefined,
    next: Read,
    kind: OwnershipEntry['kind'],
): Planned & { entry: OwnershipEntry } {
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
function blockText(path: string, current: Read | undefined): string {
    const text = current?.bytes.toString('utf8') ?? '';
    if (current !== undefined && !Buffer.from(text).equals(current.bytes))
        throw new Error(`Managed block destination is not UTF-8 text: ${path}`);
    return text;
}

// The next text and record when the recorded block is still in place, or undefined when it was edited away.
function updatedBlock(
    text: string,
    span: BlockSpan | undefined,
    recorded: OwnedBlock,
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
function insertedBlock(text: string, span: BlockSpan | undefined, style: BlockStyle, body: string): PlannedBlock {
    const nextText = applyBlock(text, body, style);
    let prefix = '';
    if (span === undefined && text !== '') prefix = text.endsWith('\n') ? '\n' : '\n\n';
    const original = span === undefined ? '' : text.slice(span.start, span.end);
    return { nextText, block: { style, installed: prefix + applyBlock('', body, style), original, prefix } };
}

// The plan a planned block yields: unchanged when the bytes already stand, otherwise the new record.
function blockPlan(
    path: string,
    current: Read | undefined,
    existing: OwnershipEntry | undefined,
    planned: PlannedBlock,
): Planned {
    const next = { bytes: Buffer.from(planned.nextText), mode: current?.mode ?? OWNER_WRITABLE_FILE };
    if (existing?.block !== undefined && matches(current, identity(next)))
        return { path, current, previous: existing, status: 'unchanged' };
    const plan = changedReplacement(path, current, existing, next, 'block');
    plan.entry.block = planned.block;
    return plan;
}

// The plan that records a merged configuration file.
function mergePlan(
    path: string,
    current: Read | undefined,
    existing: OwnershipEntry | undefined,
    plan: NonNullable<ReturnType<typeof planConfiguration>>,
): Planned {
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

// The plan that retires a file: its record loses the installed identity and keeps the original.
function retirementPlan(path: string, current: Read, existing: OwnershipEntry | undefined): Planned {
    const kind = existing?.kind ?? 'config';
    const entry: OwnershipEntry = {
        path,
        kind,
        ...(existing?.original === undefined ? {} : { original: existing.original }),
    };
    return { path, current, previous: existing, entry, saveOriginal: existing === undefined, status: 'changed' };
}

/**
 * The file as it is now, read as a link entry when the plan or the record involves a link.
 * @param log the open log
 * @param path the file
 * @param existing the file's record
 * @param next the bytes proposed for it, when a replacement is proposed
 * @returns the snapshot, or undefined when the file does not exist
 */
export function currentRead(
    log: Log,
    path: string,
    existing: OwnershipEntry | undefined,
    next?: Read,
): Read | undefined {
    const isLink = [next, existing?.installed, existing?.original].some((read) => read?.isLink === true);
    return isLink ? log.files.readEntry(path) : log.files.read(path);
}

/**
 * Proposes the next bytes of a file, preserving an edited or unowned file unless the caller takes it over.
 * @param log the open log
 * @param request the replacement and reviewed file state
 * @returns the plan
 */
export function proposeReplacement(log: Log, request: ReplacementRequest): Planned {
    const { path, next, kind, replace = false, expected, proposed } = request;
    const existing = log.entryFor(path);
    log.files.validate(path, next, proposed);
    const current = currentRead(log, path, existing, next);
    if (expected !== undefined && !isDeepStrictEqual(current, expected))
        throw new Error(`Configuration changed after replace was planned: ${path}. Retry the command.`);
    const installed = identity(next);
    // An edited owned file is preserved unless the caller reviewed those exact bytes and authorizes the replacement.
    if (isPreservedReplacement(existing, current, installed, kind, replace, expected))
        return { path, current, previous: existing, status: 'preserved' };
    if (existing !== undefined && matches(current, installed))
        return { path, current, previous: existing, status: 'unchanged' };
    return changedReplacement(path, current, existing, next, kind);
}

/**
 * Proposes the managed block of a file, preserving the file when its recorded block was edited away.
 * @param log the open log
 * @param path the file
 * @param body the block body
 * @param style the comment style of the block markers
 * @returns the plan
 */
export function proposeBlock(log: Log, path: string, body: string, style: BlockStyle): Planned {
    const existing = log.entryFor(path);
    const current = log.files.read(path);
    const text = blockText(path, current);
    const span = blockSpan(text, style);
    const recorded = existing?.block;
    if (recorded !== undefined && current !== undefined) {
        const planned = updatedBlock(text, span, recorded, style, body);
        if (planned === undefined) return { path, current, previous: existing, status: 'preserved' };
        return blockPlan(path, current, existing, planned);
    }
    if (existing !== undefined && current !== undefined && !matches(current, existing.installed))
        return { path, current, previous: existing, status: 'preserved' };
    return blockPlan(path, current, existing, insertedBlock(text, span, style, body));
}

/**
 * Proposes merged fields in a configuration file the repository authored.
 * @param log the open log
 * @param path the file
 * @param format the file's format
 * @param changes the keys and the values they must hold
 * @param replace whether an unowned file may be merged into
 * @returns the plan
 */
export function proposeConfiguration(
    log: Log,
    path: string,
    format: ConfigurationFormat,
    changes: { path: (string | number)[]; value: unknown }[],
    replace = false,
): Planned {
    const existing = log.entryFor(path);
    const current = log.files.read(path);
    const isInstalled = matches(current, existing?.installed);
    const plan = planConfiguration({
        path,
        format,
        changes,
        current,
        existing,
        matchesInstalled: isInstalled,
        replace,
    });
    if (plan === undefined) return { path, current, previous: existing, status: 'preserved' };
    if (plan.status === 'unchanged' && existing?.configuration !== undefined)
        return { path, current, previous: existing, status: 'unchanged' };
    return mergePlan(path, current, existing, plan);
}

/**
 * Proposes the removal of a file whose bytes the caller reviewed.
 * @param log the open log
 * @param path the file
 * @param expected the bytes the caller reviewed, which must still be the file's
 * @returns the plan
 */
export function proposeRetirement(log: Log, path: string, expected: Read): Planned {
    const existing = log.entryFor(path);
    const current = log.files.read(path);
    if (!isDeepStrictEqual(current, expected))
        throw new Error(`Configuration changed after replace was planned: ${path}. Retry the command.`);
    if (current === undefined) return { path, current, previous: existing, status: 'unchanged' };
    if (existing !== undefined && !matches(current, existing.installed))
        return { path, current, previous: existing, status: 'preserved' };
    return retirementPlan(path, current, existing);
}

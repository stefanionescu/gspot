// The writing commands: one entry at a time, validated as load does, then apply. set and allow live next door.
import { applyAll } from '#cli/emit/apply.ts';
import { PolicyError } from '#cli/policy/read.ts';
import { nearMatches } from '#cli/policy/near.ts';
import { openSession } from '#cli/run/session.ts';
import type { CommandResult } from '#types/run.ts';
import * as messages from '#cli/policy/messages.ts';
import { allChecks } from '#cli/presets/listing.ts';
import type { Raw, Mutation } from '#types/config.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { presetManifests } from '#cli/presets/read.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { isReasonAccepted } from '#cli/policy/loosening.ts';
import { writePolicy, appendEntry, removeEntries } from '#cli/policy/write.ts';
import type { AddOptions, DeclareOptions, IgnoreOptions, RemoveOptions } from '#types/commands.ts';

function knownCheck(id: string): void {
    if (allChecks().has(id)) {
        return;
    }

    const known = allChecks().keys().toArray();
    throw new PolicyError([messages.unknownCheck(id, nearMatches(id, known))]);
}

function quoted(paths: string[]): string {
    return paths.map((path) => `"${path}"`).join(' ');
}

function ignoreCommandLine(o: IgnoreOptions): string {
    const rule = o.rule === undefined ? '' : ` --rule ${o.rule}`;
    const paths = o.paths === undefined ? '' : ` --paths ${quoted(o.paths)}`;
    return `gspot ignore ${o.check}${rule}${paths} --reason "..."`;
}

function ignoreEntry(o: IgnoreOptions): { entry: Raw; lines: string[] } {
    const entry: Raw = { check: o.check };
    const lines = ['[[ignore]]', `check  = "${o.check}"`];
    if (o.rule !== undefined) {
        entry['rule'] = o.rule;
        lines.push(`rule   = "${o.rule}"`);
    }
    if (o.paths !== undefined && o.paths.length > 0) {
        entry['paths'] = o.paths;
        lines.push(`paths  = ${JSON.stringify(o.paths)}`);
    }
    entry['reason'] = o.reason;
    lines.push(`reason = ${JSON.stringify(o.reason)}`);
    return { entry, lines };
}

async function removeIgnore(root: string, o: IgnoreOptions): Promise<CommandResult> {
    const counter = { removed: 0 };
    const paths = JSON.stringify(o.paths ?? []);
    const isMatch = (entry: Raw): boolean =>
        entry['check'] === o.check &&
        (entry['rule'] ?? undefined) === o.rule &&
        JSON.stringify(entry['paths'] ?? []) === paths;
    const result = await commit(root, removeEntries('ignore', isMatch, counter), o.isDryRun, '');
    const noun = counter.removed === 1 ? 'entry' : 'entries';
    const text =
        counter.removed === 0
            ? 'no matching ignore entry'
            : `removed ${String(counter.removed)} ignore ${noun} for ${o.check}`;
    return { ...result, text: `${text}\n` };
}

function presetHolder(raw: Raw, scope: string | undefined): Raw {
    if (scope === undefined) return raw;
    const scopes = (raw['scope'] as Raw[] | undefined) ?? [];
    const holder = scopes.find((entry) => entry['path'] === scope);
    if (!holder) throw new PolicyError([messages.scopeMissing(scope)]);
    return holder;
}

async function removeDeclaration(root: string, o: DeclareOptions): Promise<CommandResult> {
    const counter = { removed: 0 };
    const paths = JSON.stringify(o.paths);
    const isMatch = (entry: Raw): boolean => JSON.stringify(entry['paths']) === paths;
    const result = await commit(root, removeEntries('declare', isMatch, counter), o.isDryRun, '');
    const text =
        counter.removed === 0 ? 'no matching declare entry' : `removed the declaration for ${o.paths.join(' ')}`;
    return { ...result, text: `${text}\n` };
}

function declareEntry(o: DeclareOptions): { entry: Raw; lines: string[] } {
    const entry: Raw = { paths: o.paths };
    const lines = ['[[declare]]', `paths = ${JSON.stringify(o.paths)}`];
    if (o.producedBy !== undefined) {
        entry['produced_by'] = o.producedBy;
        lines.push(`produced_by = ${JSON.stringify(o.producedBy)}`);
    }
    if (o.vendored) {
        entry['vendored'] = true;
        lines.push('vendored = true');
    }
    if (o.reason !== undefined) {
        entry['reason'] = o.reason;
        lines.push(`reason = ${JSON.stringify(o.reason)}`);
    }
    return { entry, lines };
}

/**
 * Applies one mutation to gspot.toml and runs apply, or prints the change on a dry run.
 * @param root the repository root
 * @param mutation the change to the raw document
 * @param isDryRun when true nothing is written and apply does not run
 * @param describe the text that tells the user what changed
 * @returns the command result with exit code 0
 */
export async function commit(
    root: string,
    mutation: Mutation,
    isDryRun: boolean,
    describe: string,
): Promise<CommandResult> {
    const result = writePolicy(root, mutation, isDryRun);
    if (isDryRun)
        return {
            text: `${describe}\n(dry run: gspot.toml not written)\n`,
            json: { text: result.text, dryRun: true },
            exitCode: 0,
        };
    const session = await openSession(root);
    await applyAll(session);
    return { text: `${describe}\n`, json: { changed: result.changed }, exitCode: 0 };
}

/**
 * Refuses a missing or placeholder reason.
 * @param reason the reason the user gave, if any
 * @param where the command the reason belongs to, for the message
 * @param command the full command line that carries the reason
 */
export function requireReason(reason: string | undefined, where: string, command: string): void {
    if (reason === undefined) throw new PolicyError([messages.missingReason(where, command)]);
    if (!isReasonAccepted(reason)) throw new PolicyError([messages.refusedReason(where, reason)]);
}

/**
 * Refuses an accepted-looking reason that the loosening rules reject; a missing reason passes.
 * @param reason the reason the user gave, if any
 * @param where the command the reason belongs to, for the message
 */
export function refuseBadReason(reason: string | undefined, where: string): void {
    if (reason !== undefined && !isReasonAccepted(reason))
        throw new PolicyError([messages.refusedReason(where, reason)]);
}

/**
 * gspot ignore: writes one [[ignore]] entry with its reason, or removes the entries that match.
 * @param o the parsed flags
 * @returns the command result
 */
export async function ignoreCommand(o: IgnoreOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    knownCheck(o.check);
    if (o.remove) return removeIgnore(root, o);
    requireReason(o.reason, `gspot ignore ${o.check}`, ignoreCommandLine(o));
    const { entry, lines } = ignoreEntry(o);
    return commit(root, appendEntry('ignore', entry), o.isDryRun, lines.join('\n'));
}

/**
 * gspot add: appends presets to the root list or to one scope's list.
 * @param o the parsed flags
 * @returns the command result
 */
export async function addCommand(o: AddOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const manifests = presetManifests();
    for (const id of o.presets)
        if (!manifests.has(id)) {
            const known = manifests.keys().toArray();
            throw new PolicyError([messages.unknownPreset(id, nearMatches(id, known))]);
        }
    const mutation: Mutation = (raw) => {
        const holder = presetHolder(raw, o.scope);
        const list = (holder['presets'] as string[] | undefined) ?? [];
        for (const id of o.presets) if (!list.includes(id)) list.push(id);
        holder['presets'] = list;
    };
    const where = o.scope === undefined ? '' : ` to scope ${o.scope}`;
    return commit(root, mutation, o.isDryRun, `added ${o.presets.join(', ')}${where}`);
}

/**
 * gspot remove: drops one preset from the root list or from one scope's list.
 * @param o the parsed flags
 * @returns the command result
 */
export async function removeCommand(o: RemoveOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const mutation: Mutation = (raw) => {
        const holder = presetHolder(raw, o.scope);
        const list = (holder['presets'] as string[] | undefined) ?? [];
        holder['presets'] = list.filter((id) => id !== o.preset);
    };
    const where = o.scope === undefined ? '' : ` from scope ${o.scope}`;
    return commit(root, mutation, o.isDryRun, `removed ${o.preset}${where}; files it rendered are gone after apply`);
}

/**
 * gspot declare: records a generated or vendored path set, or removes the matching declaration.
 * @param o the parsed flags
 * @returns the command result
 */
export async function declareCommand(o: DeclareOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    if (o.remove) return removeDeclaration(root, o);
    if (o.producedBy === undefined && !o.vendored)
        throw new PolicyError([
            'gspot declare needs --produced-by "<command>" for a generated file, or --vendored --reason "..." for vendored source.',
        ]);
    if (o.vendored)
        requireReason(
            o.reason,
            'gspot declare --vendored',
            `gspot declare ${o.paths.join(' ')} --vendored --reason "..."`,
        );
    const { entry, lines } = declareEntry(o);
    return commit(root, appendEntry('declare', entry), o.isDryRun, lines.join('\n'));
}

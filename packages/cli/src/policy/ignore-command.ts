// gspot ignore: one [[ignore]] entry with its reason, or the removal of the entries that match.
import type { TomlTable } from '#types/config.ts';
import { nearMatches } from '#cli/policy/near.ts';
import type { CommandResult } from '#types/run.ts';
import * as messages from '#cli/policy/messages.ts';
import { allChecks } from '#cli/presets/listing.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import type { IgnoreOptions } from '#types/commands.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { appendEntry, removeEntries } from '#cli/policy/write.ts';
import { commitPolicy, requireReason } from '#cli/policy/commit-policy.ts';

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

function ignoreEntry(o: IgnoreOptions): { entry: TomlTable; lines: string[] } {
    const entry: TomlTable = { check: o.check };
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
    const isMatch = (entry: TomlTable): boolean =>
        entry['check'] === o.check &&
        (entry['rule'] ?? undefined) === o.rule &&
        JSON.stringify(entry['paths'] ?? []) === paths;
    const result = await commitPolicy(root, removeEntries('ignore', isMatch, counter), o.isDryRun, '');
    const noun = counter.removed === 1 ? 'entry' : 'entries';
    const text =
        counter.removed === 0
            ? 'no matching ignore entry'
            : `removed ${String(counter.removed)} ignore ${noun} for ${o.check}`;
    return { ...result, text: `${text}\n` };
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
    return commitPolicy(root, appendEntry('ignore', entry), o.isDryRun, lines.join('\n'));
}

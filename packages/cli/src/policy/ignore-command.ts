// gspot ignore: one [[ignore]] entry with its reason, or the removal of the entries that match.
import type { TomlTable } from '#cli/policy/types.ts';
import { nearMatches } from '#cli/policy/near.ts';
import type { CommandResult } from '#cli/run/types.ts';
import * as messages from '#cli/policy/messages.ts';
import { allChecks } from '#cli/presets/listing.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import type { IgnoreOptions } from '#cli/commands/types.ts';
import { readPolicy, PolicyError } from '#cli/policy/read-policy.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { appendEntry, removeEntries } from '#cli/policy/write.ts';
import { commitPolicy, requireReason } from '#cli/policy/commit-policy.ts';

function knownCheck(checkName: string, repositoryChecks: string[]): void {
    if (allChecks().has(checkName) || repositoryChecks.includes(checkName)) {
        return;
    }

    const known = [...allChecks().keys(), ...repositoryChecks];
    throw new PolicyError([messages.unknownCheck(checkName, nearMatches(checkName, known))]);
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
    if (o.reason !== undefined) {
        entry['reason'] = o.reason;
        lines.push(`reason = ${JSON.stringify(o.reason)}`);
    }
    return { entry, lines };
}

async function removeIgnore(root: string, o: IgnoreOptions): Promise<CommandResult> {
    const counter = { removed: 0 };
    const paths = JSON.stringify(o.paths ?? []);
    const isMatch = (entry: TomlTable): boolean =>
        entry['check'] === o.check &&
        (entry['rule'] ?? undefined) === o.rule &&
        JSON.stringify(entry['paths'] ?? []) === paths;
    const result = await commitPolicy(root, removeEntries('ignore', isMatch, counter), false, '');
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
    const { policy } = readPolicy(root);
    knownCheck(
        o.check,
        policy.checks.map((check) => check.name),
    );
    if (o.remove) return removeIgnore(root, o);
    if (policy.requireReasons) requireReason(o.reason, `gspot ignore ${o.check}`, ignoreCommandLine(o));
    const { entry, lines } = ignoreEntry(o);
    return commitPolicy(root, appendEntry('ignore', entry), false, lines.join('\n'));
}

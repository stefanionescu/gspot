// gspot declare: a generated or vendored path set, or the removal of a declaration.
import type { TomlTable } from '#types/config.ts';
import type { CommandResult } from '#types/run.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import type { DeclareOptions } from '#types/commands.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import { appendEntry, removeEntries } from '#cli/policy/write.ts';
import { commitPolicy, requireReason } from '#cli/policy/commit-policy.ts';

async function removeDeclaration(root: string, o: DeclareOptions): Promise<CommandResult> {
    const counter = { removed: 0 };
    const paths = JSON.stringify(o.paths);
    const isMatch = (entry: TomlTable): boolean => JSON.stringify(entry['paths']) === paths;
    const result = await commitPolicy(root, removeEntries('declare', isMatch, counter), o.isDryRun, '');
    const text =
        counter.removed === 0 ? 'no matching declare entry' : `removed the declaration for ${o.paths.join(' ')}`;
    return { ...result, text: `${text}\n` };
}

function declareEntry(o: DeclareOptions): { entry: TomlTable; lines: string[] } {
    const entry: TomlTable = { paths: o.paths };
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
    return commitPolicy(root, appendEntry('declare', entry), o.isDryRun, lines.join('\n'));
}

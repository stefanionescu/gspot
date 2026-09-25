import { applyAll } from '#cli/commands/apply/workflow.ts';
import { directoryOf } from '#cli/commands/flags.ts';
import type { CommandResult } from '#cli/commands/print-result.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import type { Session } from '#cli/execution/session.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import type { ApplyReport } from '#cli/lifecycle/apply.ts';
import type { DriftEntry } from '#cli/lifecycle/drift.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { eslintRuleDiff } from '#cli/lifecycle/eslint-rule-diff.ts';
import { pinnedVersion } from '#cli/lifecycle/version-pin.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import packageManifest from '#package' with { type: 'json' };
import type { Command } from 'commander';

const { version: GSPOT_VERSION } = packageManifest;

/**
 * Registers apply.
 * @param program the commander program
 */
export function registerApply(program: Command): void {
    program
        .command('apply')
        .summary('Generate tool files')
        .description('Generate configuration from gspot.toml')
        .addHelpText(
            'after',
            '\nEffects:\nReads gspot.toml and regenerates owned configuration, rule copies, and selected integrations. Authored or edited files remain subject to ownership validation. --dry-run previews the proposal without writing project files. This command does not install newly selected tools.\n\nExit codes:\n0: configuration was applied, or the preview completed. 2: invalid input or inability to complete the request.\n\nExample:\ngspot apply --dry-run',
        )
        .option('--dry-run', 'Preview proposed changes without writing project files')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    applyCommand({
                        cwd: directoryOf(global),
                        isDryRun: flags['dryRun'] === true,
                    }),
                global,
            );
        });
}

export type ApplyOptions = {
    cwd: string;
    isDryRun: boolean;
};

function driftText(drift: DriftEntry[]): string {
    const noun = drift.length === 1 ? 'file' : 'files';
    const lines = [`${String(drift.length)} generated ${noun} drifted:`, ''];
    for (const entry of drift) {
        lines.push(`  ${entry.path}  ${entry.kind}`);
        for (const rules of entry.rules ?? []) {
            const at = rules.path === '' ? 'root' : rules.path;
            if (rules.added.length > 0) lines.push(`    ${at}: added ${rules.added.join(', ')}`);
            if (rules.removed.length > 0) lines.push(`    ${at}: removed ${rules.removed.join(', ')}`);
            if (rules.changed.length > 0) lines.push(`    ${at}: changed ${rules.changed.join(', ')}`);
        }
        if (entry.ruleError !== undefined) lines.push(`    ${entry.ruleError}`);
        if (entry.diff !== undefined && entry.diff !== '')
            lines.push(
                entry.diff
                    .split('\n')
                    .map((line) => `    ${line}`)
                    .join('\n'),
            );
    }
    lines.push(
        '',
        'Change policy in gspot.toml, then run gspot apply. Edited outputs are preserved; move them aside before regenerating.',
    );
    return `${lines.join('\n')}\n`;
}

async function previewApply(session: Session): Promise<CommandResult> {
    const proposal = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    });
    const drift = computeDrift(
        session.root,
        session.policyFiles.policy,
        session.packageManager !== undefined,
        proposal,
    );
    await eslintRuleDiff(
        session.root,
        session.scopes.find((selection) => selection.scope.path === '')?.view,
        session.cancelSignal,
        proposal,
        drift,
    );
    const summary = drift.length === 0 ? 'every generated file matches its proposal\n' : driftText(drift);
    const text = summary + proposal.notes.map((note) => `note     ${note}\n`).join('');
    const pin = { from: pinnedVersion(session.root), to: GSPOT_VERSION };
    return {
        text: `version ${pin.from ?? 'unpinned'} -> ${pin.to}\n${text}`,
        json: { isDryRun: true, pin, drift, notes: proposal.notes },
        exitCode: 0,
    };
}

function reportText(report: ApplyReport): string {
    const lines = [
        ...report.written.map((path) => `wrote    ${path}`),
        ...report.blocks.map((path) => `block    ${path}`),
        ...report.packages.map((path) => `scripts  ${path}`),
        ...report.removed.map((path) => `removed  ${path}`),
        ...report.notes.map((note) => `note     ${note}`),
    ];
    if (lines.length === 0) lines.push(`everything up to date (${String(report.unchanged.length)} files)`);
    return `${lines.join('\n')}\n`;
}

/**
 * Generates configuration or previews proposed changes without writing.
 * @param options the parsed flags
 * @returns the command result
 */
export async function applyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    if (options.isDryRun) return previewApply(session);
    const report = await applyAll(session);
    return { text: reportText(report), json: report, exitCode: 0 };
}

import { join, resolve } from 'node:path';
import { findRoot } from '#cli/repository/root.ts';
import { preparePolicy } from '#cli/policy/edit.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import type { Session } from '#cli/types/planning.ts';
import { writePolicyFile } from '#cli/policy/file.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { printResult } from '#cli/terminal/messages.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { readVersionPin } from '#cli/lifecycle/version-pin.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { reconcileConfigurations } from '#cli/lifecycle/reconcile.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import type { Drift, ApplyReport } from '#cli/types/lifecycle/apply.ts';
import type { ApplyOptions, ApplyPreviewJson } from '#cli/types/commands/apply.ts';

function driftText(drift: Drift[]): string {
    const noun = drift.length === 1 ? 'file' : 'files';
    const lines = [`${String(drift.length)} generated ${noun} need updating:`, ''];
    for (const entry of drift) {
        const rules = (entry.rules ?? []).flatMap((rule) => {
            const at = rule.path === '' ? 'root' : rule.path;
            return (['added', 'removed', 'changed'] as const)
                .filter((change) => rule[change].length > 0)
                .map((change) => `    ${at}: ${change} ${rule[change].join(', ')}`);
        });
        const differences = (entry.diff ?? '').split('\n').map((line) => `    ${line}`);
        lines.push(`  ${entry.path}  ${entry.kind}`, ...rules);
        if ((entry.diff ?? '') !== '') lines.push(...differences);
    }
    lines.push(
        '',
        'Run gspot apply to write these files. apply keeps a generated file you edited; move it aside to get the new version.',
    );
    return `${lines.join('\n')}\n`;
}

function previewApply(session: Session, policy: string, configurations: string[]): CommandResult {
    const generated = emitAll(session);
    const drift = computeDrift(session.root, session.policyFiles.policy, generated);
    const summary = drift.length === 0 ? 'every generated file is up to date\n' : driftText(drift);
    const text = summary + generated.notes.map((note) => `note     ${note}\n`).join('');
    const pin = { from: readVersionPin(session.root), to: session.version };
    const json: ApplyPreviewJson = { dryRun: true, policy, configurations, pin, drift, notes: generated.notes };
    const version = pin.from === pin.to ? '' : `version ${pin.from ?? 'unpinned'} -> ${pin.to}\n`;
    return { text: `${version}${text}`, json, exitCode: 0 };
}

function reportText(report: ApplyReport): string {
    const lines = [
        ...report.written.map((path) => `wrote    ${path}`),
        ...report.updated.map((path) => `updated  ${path}`),
        ...report.removed.map((path) => `removed  ${path}`),
        ...report.notes.map((note) => `note     ${note}`),
    ];
    if (lines.length === 0) lines.push(`everything up to date (${String(report.unchanged.length)} files)`);
    return `${lines.join('\n')}\n`;
}

/**
 * Registers apply.
 * @param program the commander program
 */
export function registerApply(program: Program): void {
    program
        .command('apply')
        .summary('Write the configuration from gspot.toml')
        .description(
            'Reconcile configurations with the repository, then regenerate tool config files, coding-agent rules, Git hooks, and the CI workflow from gspot.toml. A generated file you edited stays as it is, and apply names it. --dry-run shows every change, including each rule that changes, without writing project files. apply installs no tools: run gspot install after it.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the configuration was written, or the preview finished.\n- 2: the input was invalid, or apply could not finish.\n\nExample:\ngspot apply --dry-run',
        )
        .option('--dry-run', 'Show the changes without writing project files')
        .action(async (flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(
                await applyCommand({
                    cwd,
                    isDryRun: flags.dryRun === true,
                }),
            );
        });
}

/**
 * Generates configuration or previews proposed changes without writing.
 * @param options the parsed flags
 * @returns the command result
 */
export async function applyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    using log = options.isDryRun ? undefined : openOwnership(root);
    const current = await openSession(root);
    const reconciliation = reconcileConfigurations(current);
    const proposal = preparePolicy(root, reconciliation.mutate);
    if (!proposal.original.bytes.equals(Buffer.from(current.policyFiles.text)))
        throw new GspotError('policy', ['The gspot.toml file changed while gspot was running. Run the command again.']);
    const session = await openSession(root, {
        policy: proposal.policy,
        text: proposal.text,
        path: join(root, POLICY_FILE),
        errors: [],
    });
    if (log === undefined) {
        const result = previewApply(session, proposal.text, reconciliation.notes);
        return {
            ...result,
            text: `${reconciliation.notes.map((note) => 'note     ' + note + '\n').join('')}${result.text}`,
        };
    }
    const generated = emitAll(session);
    writePolicyFile({
        files: log.files,
        text: proposal.text,
        original: proposal.original,
        publish: (next, expected) => {
            applyPlan(log, {
                ...proposeReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }),
                before: expected,
            });
        },
    });
    const report = writeOutputs(session, log, undefined, generated);
    report.notes.unshift(...reconciliation.notes);
    return { text: reportText(report), json: report, exitCode: 0 };
}

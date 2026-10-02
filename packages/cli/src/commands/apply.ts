import { emitAll } from '#cli/generation/outputs.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import packageManifest from '#package' with { type: 'json' };
import { printCommand } from '#cli/commands/print-result.ts';
import { pinnedVersion } from '#cli/lifecycle/version-pin.ts';
import { eslintRuleDiff } from '#cli/lifecycle/preview/eslint/diff.ts';
import type { DriftEntry, ApplyReport } from '#cli/types/lifecycle/lifecycle.ts';
import type { Program, ApplyOptions, CommandResult, ApplyPreviewJson } from '#cli/types/commands/commands.ts';

const { version: GSPOT_VERSION } = packageManifest;

function driftText(drift: DriftEntry[]): string {
    const noun = drift.length === 1 ? 'file' : 'files';
    const lines = [`${String(drift.length)} generated ${noun} drifted:`, ''];
    for (const entry of drift) {
        const rules = (entry.rules ?? []).flatMap((rule) => {
            const at = rule.path === '' ? 'root' : rule.path;
            return (['added', 'removed', 'changed'] as const)
                .filter((change) => rule[change].length > 0)
                .map((change) => `    ${at}: ${change} ${rule[change].join(', ')}`);
        });
        const errors = entry.ruleError === undefined ? [] : [`    ${entry.ruleError}`];
        const differences = (entry.diff ?? '').split('\n').map((line) => `    ${line}`);
        lines.push(`  ${entry.path}  ${entry.kind}`, ...rules, ...errors);
        if ((entry.diff ?? '') !== '') lines.push(...differences);
    }
    lines.push(
        '',
        'Change policy in gspot.toml, then run gspot apply. Edited outputs are preserved; move them aside before regenerating.',
    );
    return `${lines.join('\n')}\n`;
}

async function previewApply(session: Session): Promise<CommandResult> {
    const plan = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    });
    const drift = computeDrift(session.root, session.policyFiles.policy, plan);
    await eslintRuleDiff(
        session.root,
        session.scopes.find((selection) => selection.scope.path === '')?.view,
        session.cancelSignal,
        plan,
        drift,
    );
    const summary = drift.length === 0 ? 'every generated file matches its plan\n' : driftText(drift);
    const text = summary + plan.notes.map((note) => `note     ${note}\n`).join('');
    const pin = { from: pinnedVersion(session.root), to: GSPOT_VERSION };
    const json: ApplyPreviewJson = { isDryRun: true, pin, drift, notes: plan.notes };
    return { text: `version ${pin.from ?? 'unpinned'} -> ${pin.to}\n${text}`, json, exitCode: 0 };
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
 * Registers apply.
 * @param program the commander program
 */
export function registerApply(program: Program): void {
    program
        .command('apply')
        .summary('Write the configuration from gspot.toml')
        .description('Regenerate the tool configuration, rules, and hooks from gspot.toml')
        .addHelpText(
            'after',
            '\nEffects:\nReads gspot.toml and writes the tool configuration, the rules for coding agents, and the selected integrations. A generated file you edited stays as it is, and apply names it. --dry-run shows every change, including each rule that changes, without writing project files. apply installs no tools: run gspot install after it.\n\nExit codes:\n- 0: the configuration was written, or the preview finished.\n- 2: the input was invalid, or apply could not finish.\n\nExample:\ngspot apply --dry-run',
        )
        .option('--dry-run', 'Show the changes without writing project files')
        .action(async (flags, command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                (cwd) =>
                    applyCommand({
                        cwd,
                        isDryRun: flags.dryRun === true,
                    }),
                global,
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
    const session = await openSession(root);
    if (options.isDryRun) return previewApply(session);
    const report = await writeOutputs(session);
    return { text: reportText(report), json: report, exitCode: 0 };
}

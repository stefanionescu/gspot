// upgrade: report what a version changes, re-render, install, then move the pin.
import { openSession } from '#cli/run/session.ts';
import type { CommandResult } from '#types/run.ts';
import { applyAll } from '#cli/emit/apply-command.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { askConfirmation } from '#cli/output/prompts.ts';
import type { UpgradeOptions } from '#types/lifecycle.ts';
import { installTools } from '#cli/lifecycle/install-tools.ts';
import { newerVersion } from '#cli/lifecycle/upgrade/newer-version.ts';
import { GSPOT_VERSION, pinnedVersion, writePin } from '#cli/run/version-pin.ts';
import { upgradeReport, upgradeReportLines } from '#cli/lifecycle/upgrade/report.ts';

function otherBinaryText(target: string): string {
    return `This binary is ${GSPOT_VERSION}. Install gspot ${target} first (mise use github:stefanionescu/gspot@${target}, or your package manager), then run gspot upgrade --to ${target} with it.`;
}

async function alreadyAtTarget(header: string[], pinned: string | undefined, target: string): Promise<CommandResult> {
    const newer = await newerVersion(GSPOT_VERSION);
    const line =
        newer === undefined
            ? `Already at ${target}, the newest version.`
            : `Already at ${target}. ${newer} is available: install it and run gspot upgrade again.`;
    return {
        text: `${[...header, line].join('\n')}\n`,
        json: { pinned, target, newer: newer ?? null, changes: [] },
        exitCode: 0,
    };
}

function actionLines(target: string, isInstalling: boolean): string[] {
    return [
        'action on upgrade',
        `  re-render .gspot/${isInstalling ? ', run the install step' : ''}, then move the pin to ${target}`,
        '',
    ];
}

async function applyUpgrade(
    root: string,
    options: UpgradeOptions,
    pinned: string | undefined,
    target: string,
    lines: string[],
): Promise<CommandResult> {
    const session = await openSession(root);
    const synced = await applyAll(session);
    const { tool: runner } = session.policyFiles.policy.runner;
    const installNote = await installTools(root, runner, synced, options.install);
    writePin(root, target);
    const install = installNote === '' ? '' : `; ${installNote}`;
    lines.push(
        `pinned ${target}${install}`,
        'commit the diff of .gspot/ to finish',
        'Run gspot check to check this repository.',
    );
    return {
        text: `${lines.join('\n')}\n`,
        json: { pinned, target, applied: true, install: installNote },
        exitCode: 0,
    };
}

/**
 * Runs upgrade. The report compares what is on disk with this binary's render and pins; a target version other than this binary's is installed first.
 * @param options the parsed flags
 * @returns the command result
 */
export async function upgradeCommand(options: UpgradeOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const pinned = pinnedVersion(root);
    const target = options.to ?? GSPOT_VERSION;
    const header = [`gspot ${pinned ?? 'unpinned'} -> ${target}`, ''];
    if (target !== GSPOT_VERSION)
        return {
            text: `${[...header, otherBinaryText(target)].join('\n')}\n`,
            json: { pinned, target, running: GSPOT_VERSION },
            exitCode: 2,
        };
    if (pinned === target) return alreadyAtTarget(header, pinned, target);
    const report = upgradeReport(await openSession(root));
    const lines = [...header, ...upgradeReportLines(report), ...actionLines(target, options.install)];
    if (options.isDryRun)
        return { text: `${lines.join('\n')}\n`, json: { pinned, target, report, isDryRun: true }, exitCode: 0 };
    const isGo = await askConfirmation('Apply the upgrade?', '--yes', true, options.yes);
    if (!isGo) return { text: 'Nothing changed.\n', json: { pinned, target, applied: false }, exitCode: 0 };
    return applyUpgrade(root, options, pinned, target, lines);
}

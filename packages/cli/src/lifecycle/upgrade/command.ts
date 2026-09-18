// upgrade: report what a version changes, move the pin, re-render, baseline what arrives, install.
import { openSession } from '#cli/run/session.ts';
import type { CommandResult } from '#types/run.ts';
import { isConfirmed } from '#cli/output/prompts.ts';
import { applyAll } from '#cli/emit/apply-command.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { firstRun } from '#cli/lifecycle/first-check.ts';
import type { UpgradeOptions } from '#types/lifecycle.ts';
import { newerVersion } from '#cli/doctor/newer-version.ts';
import { installTools } from '#cli/lifecycle/install-tools.ts';
import { GSPOT_VERSION, pinnedVersion, writePin } from '#cli/run/version-pin.ts';
import { upgradeReport, upgradeReportLines } from '#cli/lifecycle/upgrade/report.ts';

function otherBinaryText(target: string): string {
    return `This binary is ${GSPOT_VERSION}. Install gspot ${target} first (mise use ubi:stefanionescu/gspot@${target}, or your package manager), then run gspot upgrade --to ${target} with it.`;
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
        `  move the pin to ${target}, re-render .gspot/, baseline what arrives${isInstalling ? ', run the install step' : ''}`,
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
    writePin(root, target);
    const session = await openSession(root);
    const synced = await applyAll(session, options.binaryPath);
    const { surface } = session.policyFiles.policy.runner;
    const installNote = await installTools(root, surface, synced, options.install);
    const { baselines: written } = await firstRun(root);
    const noun = written.length === 1 ? 'baseline' : 'baselines';
    const install = installNote === '' ? '' : `; ${installNote}`;
    lines.push(
        `pinned ${target}; ${String(written.length)} new ${noun}${install}`,
        'commit the diff of .gspot/ to finish',
    );
    return {
        text: `${lines.join('\n')}\n`,
        json: { pinned, target, applied: true, baselines: written, install: installNote },
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
    if (options.check)
        return { text: `${lines.join('\n')}\n`, json: { pinned, target, report, isDryRun: true }, exitCode: 0 };
    const isGo = await isConfirmed('Apply the upgrade?', '--yes', true, options.yes);
    if (!isGo) return { text: 'Nothing changed.\n', json: { pinned, target, applied: false }, exitCode: 0 };
    return applyUpgrade(root, options, pinned, target, lines);
}

// upgrade: report what a version changes, move the pin, re-render, baseline what arrives, install.
import { run } from '#cli/platform/spawn.ts';
import { applyAll } from '#cli/emit/apply.ts';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import type { UpgradeOptions } from '#types/emit.ts';
import { isConfirmed } from '#cli/output/prompts.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { newerVersion } from '#cli/doctor/newer-version.ts';
import type { BaselineFile, CommandResult } from '#types/run.ts';
import { writeBaselines, isBaselineAllowed } from '#cli/run/baselines.ts';
import { upgradeReport, upgradeReportLines } from '#cli/emit/upgrade/report.ts';
import { GSPOT_VERSION, pinnedVersion, writePin } from '#cli/run/version-pin.ts';

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

function installCommand(surface: string): string[] {
    if (surface === 'mise') return ['mise', 'install'];
    if (surface === 'uv') return ['uv', 'sync', '--group', 'gspot'];
    return [surface, 'install'];
}

async function installAfterUpgrade(root: string, surface: string): Promise<string> {
    const command = installCommand(surface);
    if (surface === 'mise') await run(['mise', 'trust', '.config/mise/conf.d/gspot.toml'], { cwd: root });
    const result = await run(command, { cwd: root });
    const shown = command.join(' ');
    return result.code === 0 ? `ran ${shown}` : `${shown} failed; gspot doctor names what is missing`;
}

async function baselineAfterUpgrade(root: string): Promise<BaselineFile[]> {
    const fresh = await openSession(root);
    const outcome = await executeRun(fresh, {
        stage: 'all',
        skips: [],
        localSkips: fresh.policyFiles.local.skip,
        fix: false,
        isDryRun: false,
        noCache: true,
    });
    const allowed = new Set(
        fresh.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) =>
                manifest.checks.filter((check) => isBaselineAllowed(check.inspection)).map((check) => check.id),
            ),
        ),
    );
    const findings = outcome.record.checks.flatMap((check) => check.findings);
    return writeBaselines(root, findings, (check) => allowed.has(check));
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
    await applyAll(session, options.binaryPath);
    const { surface } = session.policyFiles.policy.runner;
    const installNote = surface !== 'none' && options.install ? await installAfterUpgrade(root, surface) : '';
    const written = await baselineAfterUpgrade(root);
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

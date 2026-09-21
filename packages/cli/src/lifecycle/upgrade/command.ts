import semver from 'semver';
import { isDeepStrictEqual } from 'node:util';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { migratePolicy } from '#cli/lifecycle/upgrade/renames.ts';
import { policyPath, PolicyError } from '#cli/policy/read-policy.ts';
import type { Session } from '#types/run.ts';
import type { FileSnapshot } from '#types/lifecycle.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
// Prepare migrations, publish validated configuration, update the pin, then install tools.
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
            ? `Already at ${target}.`
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
        `  write validated configuration and locks, then pin ${target}`,
        ...(isInstalling ? ['  install the locked tools after the pin is written'] : []),
        '',
    ];
}

async function applyUpgrade(
    root: string,
    options: UpgradeOptions,
    pinned: string | undefined,
    target: string,
    lines: string[],
    original: FileSnapshot,
    session: Session,
): Promise<CommandResult> {
    return withLifecycleOwner(root, async (owner) => {
        if (!isDeepStrictEqual(owner.read('gspot.toml'), original) || pinnedVersion(root) !== pinned) throw new Error('Upgrade inputs changed after planning. Retry the command.');
        if (session.policyFiles.text !== original.bytes.toString('utf8')) owner.replace('gspot.toml', { bytes: Buffer.from(session.policyFiles.text), mode: original.mode }, 'policy', true, original);
        const applied = await applyAll(session);
        if (applied.preserved.length > 0) throw new Error(`Upgrade preserved edited outputs: ${applied.preserved.join(', ')}. Resolve them and retry; the version pin was not changed.`);
        writePin(root, target);
        let installNote: string;
        try { installNote = await installTools(session, options.install); }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Tool installation failed.';
            return { text: `Configuration upgraded and pinned to ${target}. ${message}\nRun: gspot install\n`, json: { pinned: target, target, applied: true, installed: false, error: message }, exitCode: 1 };
        }
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
    });
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
    if (semver.valid(target) === null) throw new PolicyError(['--to requires an exact version.']);
    const header = [`gspot ${pinned ?? 'unpinned'} -> ${target}`, ''];
    if (target !== GSPOT_VERSION)
        return {
            text: `${[...header, otherBinaryText(target)].join('\n')}\n`,
            json: { pinned, target, running: GSPOT_VERSION },
            exitCode: 2,
        };
    const files = openConfinedRoot(root);
    let original: FileSnapshot;
    try {
        const current = files.read('gspot.toml');
        if (current === undefined) throw new Error('gspot.toml is missing.');
        original = current;
    } finally { files.close(); }
    const migration = migratePolicy(root, original.bytes.toString('utf8'), pinned, target);
    if (pinned === target) return alreadyAtTarget(header, pinned, target);
    const session = await openSession(root, { policy: migration.policy, path: policyPath(root), text: migration.text });
    const report = { ...upgradeReport(session), rewrites: migration.rewrites, configurationChanged: migration.changed };
    const lines = [...header, ...migration.rewrites.map((rewrite) => `rewrite ${rewrite}`), ...upgradeReportLines(report), ...actionLines(target, options.install)];
    if (options.isDryRun)
        return { text: `${lines.join('\n')}\n`, json: { pinned, target, report, isDryRun: true }, exitCode: 0 };
    const isGo = await askConfirmation('Apply the upgrade?', '--yes', true, options.yes);
    if (!isGo) return { text: 'Nothing changed.\n', json: { pinned, target, applied: false }, exitCode: 0 };
    return applyUpgrade(root, options, pinned, target, lines, original, session);
}

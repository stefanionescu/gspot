// upgrade: report what a version changes, move the pin, re-render, baseline what arrives, install.
import { newerVersion } from '#cli/doctor/newer-version.ts';
import { askConfirm } from '#cli/output/prompts.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { syncAll } from '#cli/render/sync.ts';
import { writeBaselines, baselineAllowed } from '#cli/run/baselines.ts';
import type { CommandResult } from '#cli/run/check.ts';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import { GSPOT_VERSION, pinnedVersion, writePin } from '#cli/run/version-pin.ts';
import { run } from '#cli/platform/spawn.ts';

export type UpgradeOptions = {
    cwd: string;
    check: boolean;
    to?: string;
    yes: boolean;
    install: boolean;
    binaryPath?: string;
};

/** Runs upgrade. The report compares the pinned version with this binary's presets; a target version other than this binary's is installed first. */
export async function upgradeCommand(options: UpgradeOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const pinned = pinnedVersion(root);
    const target = options.to ?? GSPOT_VERSION;
    const lines = [`gspot ${pinned ?? 'unpinned'} -> ${target}`, ''];
    if (target !== GSPOT_VERSION) {
        lines.push(
            `This binary is ${GSPOT_VERSION}. Install gspot ${target} first (mise use ubi:stefanionescu/gspot@${target}, or your package manager), then run gspot upgrade --to ${target} with it.`,
        );
        return { text: `${lines.join('\n')}\n`, json: { pinned, target, running: GSPOT_VERSION }, exitCode: 2 };
    }
    if (pinned === target) {
        const newer = await newerVersion(GSPOT_VERSION);
        lines.push(
            newer
                ? `Already at ${target}. ${newer} is available: install it and run gspot upgrade again.`
                : `Already at ${target}, the newest version.`,
        );
        return {
            text: `${lines.join('\n')}\n`,
            json: { pinned, target, newer: newer ?? null, changes: [] },
            exitCode: 0,
        };
    }
    lines.push(
        'rules',
        '  every check in the selected presets runs at this version; new findings enter a baseline',
        '',
        'tools',
        "  the pins in the runner surface move to this version's",
        '',
        'rule files',
        "  re-rendered from this version's corpus",
        '',
        'action on upgrade',
        `  move the pin to ${target}, re-render .gspot/, baseline what arrives${options.install ? ', run the install step' : ''}`,
        '',
    );
    if (options.check) return { text: `${lines.join('\n')}\n`, json: { pinned, target, dryRun: true }, exitCode: 0 };
    const go = await askConfirm('Apply the upgrade?', '--yes', true, options.yes);
    if (!go) return { text: 'Nothing changed.\n', json: { pinned, target, applied: false }, exitCode: 0 };
    writePin(root, target);
    const session = await openSession(root);
    await syncAll(session, options.binaryPath);
    let installNote = '';
    const surface = session.loaded.policy.runner.surface;
    if (options.install && surface !== 'none') {
        const command =
            surface === 'mise'
                ? ['mise', 'install']
                : surface === 'uv'
                  ? ['uv', 'sync', '--group', 'gspot']
                  : [surface, 'install'];
        if (surface === 'mise') await run(['mise', 'trust', '.config/mise/conf.d/gspot.toml'], { cwd: root });
        const result = await run(command, { cwd: root });
        installNote =
            result.code === 0
                ? `ran ${command.join(' ')}`
                : `${command.join(' ')} failed; gspot doctor names what is missing`;
    }
    const fresh = await openSession(root);
    const outcome = await executeRun(fresh, {
        stage: 'all',
        skips: [],
        localSkips: fresh.loaded.local.skip,
        fix: false,
        dryRun: false,
        noCache: true,
    });
    const allowed = new Set(
        fresh.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) =>
                manifest.checks.filter((check) => baselineAllowed(check.inspection)).map((check) => check.id),
            ),
        ),
    );
    const written = writeBaselines(
        root,
        outcome.record.checks.flatMap((check) => check.findings),
        (check) => allowed.has(check),
    );
    lines.push(
        `pinned ${target}; ${written.length} new baseline${written.length === 1 ? '' : 's'}${installNote ? `; ${installNote}` : ''}`,
        'commit the diff of .gspot/ to finish',
    );
    return {
        text: `${lines.join('\n')}\n`,
        json: { pinned, target, applied: true, baselines: written, install: installNote },
        exitCode: 0,
    };
}

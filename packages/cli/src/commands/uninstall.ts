import { resolve } from 'node:path';
import type { Command } from 'commander';
import { directoryOf } from '#cli/platform/arguments.ts';
import { askConfirmation } from '#cli/commands/prompts.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { findRoot, isGitRepository } from '#cli/repository/tracked.ts';
import { hooksInstalled, uninstallHooks } from '#cli/lifecycle/hooks.ts';
import { OWNERSHIP_FILE, STATE_DIRECTORY } from '#cli/config/platform.ts';
import { readOwnership, runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import type { CommandResult, UninstallPlan, UninstallOptions } from '#cli/types/commands.ts';

/**
 * Preview only recorded ownership; matching templates do not authorize deletion.
 * @param root the repository being removed
 * @returns the recorded restoration and removal candidates
 */
export function planUninstall(root: string): UninstallPlan {
    const state = readOwnership(root);
    // Pending entries are candidates; the lifecycle owner confirms their state before mutation.
    const recorded = [
        ...state.files,
        ...(state.pending ?? []).flatMap((pending) => (pending.entry === undefined ? [] : [pending.entry])),
    ];
    const blocks = recorded
        .filter((entry) => entry.kind === 'block' && entry.path !== '.gitignore')
        .map((entry) => entry.path);
    const blockSet = new Set(blocks);
    const remove = new Set(recorded.map((entry) => entry.path));
    for (const path of ['gspot.toml', '.gitignore', ...blocks]) remove.delete(path);
    for (const entry of recorded) if (entry.kind === 'export') remove.delete(entry.path);
    const hooks = isGitRepository(root) && hooksInstalled(root);
    return {
        remove: [...remove].toSorted((left, right) => left.localeCompare(right)),
        blocks: [...blockSet].toSorted((left, right) => left.localeCompare(right)),
        hooks,
    };
}

/**
 * Restore unchanged or absent destinations. Preserve recovery records and subsequent edits.
 * @param root the repository being removed
 * @param plan the reviewed restoration and removal candidates
 * @returns paths preserved because they were edited or unowned
 */
export function applyUninstall(root: string, plan: UninstallPlan): string[] {
    return runOwnedLifecycle(root, (owner) => {
        const proposed = new Set([...plan.remove, ...plan.blocks]);
        const plans = [...proposed].map((path) => owner.proposeRestoration(path));
        const preserved = plans.filter((plan) => plan.status === 'preserved').map((plan) => plan.path);
        const restorations = plans.filter((plan) => plan.status !== 'preserved');
        owner.applyPlans(restorations);
        if (plan.hooks) uninstallHooks(root);
        return preserved;
    });
}

/**
 * Preview uninstall and apply the accepted operations through the lifecycle owner.
 * @param options parsed command options
 * @returns the proposed or completed removal report
 */
export async function uninstallCommand(options: UninstallOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd, ['gspot.toml', OWNERSHIP_FILE]);
    const plan = planUninstall(root);
    const text = [
        'restore originals or remove unchanged installed files',
        ...[...plan.remove, ...plan.blocks].map((path) => `  ${path}`),
        ...(plan.hooks ? ['unset core.hooksPath, so Git stops running the gspot hooks'] : []),
        'kept: gspot.toml, exported profiles, recovery data, ignore entries, unowned files, and subsequent edits',
        '',
    ].join('\n');
    if (options.isDryRun)
        return { text: `${text}--dry-run: nothing removed.\n`, json: { plan, isDryRun: true }, exitCode: 0 };
    process.stderr.write(text);
    const isGo =
        options.yes || (await askConfirmation('Apply these removals and restorations?', '--yes', false, false));
    if (!isGo) return { text: 'Nothing removed.\n', json: { plan, applied: false }, exitCode: 0 };
    const preserved = applyUninstall(root, plan);
    const retained = preserved.map((path) => `preserved edited or unowned ${path}\n`).join('');
    const destinations = new Set(preserved.map((path) => resolve(root, path)));
    const originals = readOwnership(root, STATE_DIRECTORY).files.flatMap((entry) =>
        entry.original !== undefined && destinations.has(resolve(root, entry.path))
            ? [{ path: resolve(root, entry.path), backup: resolve(root, entry.original.backup) }]
            : [],
    );
    const recovery = originals.map(({ path, backup }) => `original for ${path} retained at ${backup}\n`).join('');
    return {
        text: `${retained}${recovery}Uninstall complete. Recovery data and gspot.toml remain.\n`,
        json: { plan, applied: true, preserved, originals },
        exitCode: 0,
    };
}

/**
 * Registers uninstall.
 * @param program the commander program
 */
export function registerUninstall(program: Command): void {
    program
        .command('uninstall')
        .summary('Remove gspot from the repository')
        .description('Remove what gspot wrote, and keep gspot.toml and your own guides')
        .addHelpText(
            'after',
            '\nEffects:\nShows what gspot removes and which original files it restores, then does it after you confirm or pass --yes. A file you edited after gspot wrote it stays. gspot.toml and the recovery data stay too. --dry-run changes nothing.\n\nExit codes:\n- 0: the removal finished, was shown, or was declined.\n- 2: the input was invalid, or uninstall could not finish.\n\nExample:\ngspot uninstall --dry-run',
        )
        .option('--yes', 'Remove without asking')
        .option('--dry-run', 'Print the plan and remove nothing')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    uninstallCommand({
                        cwd: directoryOf(global),
                        yes: flags['yes'] === true,
                        isDryRun: flags['dryRun'] === true,
                    }),
                global,
            );
        });
}

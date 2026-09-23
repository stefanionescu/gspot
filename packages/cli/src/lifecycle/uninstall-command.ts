import { findRoot, isGitRepository } from '#cli/repository/tracked.ts';
import { proposeHookRestorations, hookLocation } from '#cli/lifecycle/hooks.ts';
import { askConfirmation } from '#cli/output/prompts.ts';
import { readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { relative, resolve } from 'node:path';
import type { CommandResult } from '#cli/run/types.ts';
import type { UninstallOptions, UninstallPlan, OwnershipState } from '#cli/lifecycle/types.ts';

function planText(plan: UninstallPlan): string {
    return [
        'restore originals or remove unchanged installed files',
        ...[...plan.remove, ...plan.blocks].map((path) => `  ${path}`),
        ...(plan.hooks ? ['restore or remove unchanged dispatchers in the Git-resolved hooks directory'] : []),
        'kept: gspot.toml, exported profiles, recovery data, ignore entries, unowned files, and subsequent edits',
        '',
    ].join('\n');
}

// Pending entries are candidates; the lifecycle owner confirms their state before mutation.
function restorationCandidates(state: OwnershipState) {
    return [
        ...state.files,
        ...(state.pending ?? []).flatMap((pending) => (pending.entry === undefined ? [] : [pending.entry])),
    ];
}

/**
 * Preview only recorded ownership; matching templates do not authorize deletion.
 * @param root the repository being removed
 * @returns the recorded restoration and removal candidates
 */
export function planUninstall(root: string): UninstallPlan {
    const recorded = restorationCandidates(readOwnership(root));
    const blocks = recorded
        .filter((entry) => entry.kind === 'block' && entry.path !== '.gitignore')
        .map((entry) => entry.path);
    const blockSet = new Set(blocks);
    const remove = new Set(recorded.map((entry) => entry.path));
    for (const path of ['gspot.toml', '.gitignore', ...blocks]) remove.delete(path);
    for (const entry of recorded) if (entry.kind === 'hook' || entry.kind === 'export') remove.delete(entry.path);
    const location = isGitRepository(root) ? hookLocation(root) : undefined;
    const hooks =
        location !== undefined &&
        restorationCandidates(readOwnership(location.root)).some(
            (entry) => entry.kind === 'hook' && entry.path.startsWith(`${location.directory}/`),
        );
    return {
        remove: [...remove].toSorted((left, right) => left.localeCompare(right)),
        blocks: [...blockSet].toSorted((left, right) => left.localeCompare(right)),
        hooks,
    };
}

/**
 * Restore only unchanged or absent destinations, retaining recovery and subsequent edits.
 * @param root the repository being removed
 * @param plan the reviewed restoration and removal candidates
 * @returns paths preserved because they were edited or unowned
 */
export function applyUninstall(root: string, plan: UninstallPlan): string[] {
    return withLifecycleOwner(root, (owner) => {
        const proposed = new Set([...plan.remove, ...plan.blocks]);
        const proposals = [...proposed].map((path) => owner.proposeRestoration(path));
        const preserved = proposals
            .filter((proposal) => proposal.status === 'preserved')
            .map((proposal) => proposal.path);
        const restorations = proposals.filter((proposal) => proposal.status !== 'preserved');
        if (!plan.hooks) {
            owner.applyProposals(restorations);
            return preserved;
        }
        const location = hookLocation(root);
        return withLifecycleOwner(location.root, (hooks) => {
            const planned = proposeHookRestorations(hooks, location);
            if (hooks === owner) owner.applyProposals([...restorations, ...planned.proposals]);
            else {
                owner.applyProposals(restorations);
                hooks.applyProposals(planned.proposals);
            }
            return [...preserved, ...planned.preserved.map((path) => relative(root, resolve(location.root, path)))];
        });
    });
}

/**
 * Preview uninstall and apply the accepted operations through the lifecycle owner.
 * @param options parsed command options
 * @returns the proposed or completed removal report
 */
export async function uninstallCommand(options: UninstallOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd, ['gspot.toml', '.gspot/ownership.json']);
    const plan = planUninstall(root);
    const text = planText(plan);
    if (options.isDryRun)
        return { text: `${text}--dry-run: nothing removed.\n`, json: { plan, isDryRun: true }, exitCode: 0 };
    process.stderr.write(text);
    const isGo =
        options.yes || (await askConfirmation('Apply these removals and restorations?', '--yes', false, false));
    if (!isGo) return { text: 'Nothing removed.\n', json: { plan, applied: false }, exitCode: 0 };
    const preserved = applyUninstall(root, plan);
    const retained = preserved.map((path) => `preserved edited or unowned ${path}\n`).join('');
    const roots = new Set([root]);
    if (plan.hooks) roots.add(hookLocation(root).root);
    const destinations = new Set(preserved.map((path) => resolve(root, path)));
    const originals = [...roots].flatMap((root) =>
        readOwnership(root).files.flatMap((entry) =>
            entry.original !== undefined && destinations.has(resolve(root, entry.path))
                ? [{ path: resolve(root, entry.path), backup: resolve(root, entry.original.backup) }]
                : [],
        ),
    );
    const recovery = originals.map(({ path, backup }) => `original for ${path} retained at ${backup}\n`).join('');
    return {
        text: `${retained}${recovery}Uninstall complete. Recovery data and gspot.toml remain.\n`,
        json: { plan, applied: true, preserved, originals },
        exitCode: 0,
    };
}

import { openSession } from '#cli/run/session.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { uninstallHooks, hookLocation } from '#cli/lifecycle/hooks.ts';
import { askConfirmation } from '#cli/output/prompts.ts';
import { readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import type { Session, CommandResult } from '#types/run.ts';
import type { UninstallOptions, UninstallPlan, OwnershipState } from '#types/lifecycle.ts';

function planText(plan: UninstallPlan): string {
    return [
        'restore originals or remove unchanged installed files',
        ...[...plan.remove, ...plan.blocks].map((path) => `  ${path}`),
        ...(plan.hooks ? ['restore unchanged dispatchers in the Git-resolved hooks directory'] : []),
        'kept: gspot.toml, recovery data, ignore entries, unowned files, and subsequent edits',
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
 * @param session the repository being removed
 * @returns the recorded restoration and removal candidates
 */
export function planUninstall(session: Session): UninstallPlan {
    const recorded = restorationCandidates(readOwnership(session.root));
    const blocks = recorded
        .filter((entry) => entry.kind === 'block' && entry.path !== '.gitignore')
        .map((entry) => entry.path);
    const blockSet = new Set(blocks);
    const remove = new Set(recorded.map((entry) => entry.path));
    for (const path of ['gspot.toml', '.gitignore', ...blocks]) remove.delete(path);
    for (const entry of recorded) if (entry.kind === 'hook') remove.delete(entry.path);
    const location = session.repository.hasGit ? hookLocation(session.root) : undefined;
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
 * @param session the repository being removed
 * @param plan the reviewed restoration and removal candidates
 * @returns paths preserved because they were edited or unowned
 */
export function applyUninstall(session: Session, plan: UninstallPlan): string[] {
    return withLifecycleOwner(session.root, (owner) => {
        const proposed = new Set([...plan.remove, ...plan.blocks]);
        const proposals = [...proposed].map((path) => owner.proposeRestoration(path));
        const preserved = proposals
            .filter((proposal) => proposal.status === 'preserved')
            .map((proposal) => proposal.path);
        owner.applyProposals(proposals.filter((proposal) => proposal.status !== 'preserved'));
        if (plan.hooks) preserved.push(...uninstallHooks(session));
        return preserved;
    });
}

/**
 * Preview uninstall and apply the accepted operations through the lifecycle owner.
 * @param options parsed command options
 * @returns the proposed or completed removal report
 */
export async function uninstallCommand(options: UninstallOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    const plan = planUninstall(session);
    const text = planText(plan);
    if (options.isDryRun)
        return { text: `${text}--dry-run: nothing removed.\n`, json: { plan, isDryRun: true }, exitCode: 0 };
    process.stderr.write(text);
    const isGo =
        options.yes || (await askConfirmation('Apply these removals and restorations?', '--yes', false, false));
    if (!isGo) return { text: 'Nothing removed.\n', json: { plan, applied: false }, exitCode: 0 };
    const preserved = applyUninstall(session, plan);
    const retained = preserved.map((path) => `preserved edited or unowned ${path}\n`).join('');
    return {
        text: `${retained}Uninstall complete. Recovery data and gspot.toml remain.\n`,
        json: { plan, applied: true, preserved },
        exitCode: 0,
    };
}

// uninstall: print the plan, ask, remove what init wrote.
import { askConfirm } from '#cli/output/prompts.ts';
import { applyUninstall, planUninstall } from '#cli/render/uninstall.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/run/session.ts';
import type { CommandResult } from '#cli/run/check.ts';

/** Runs uninstall. */
export async function uninstallCommand(options: {
    cwd: string;
    keepHooks: boolean;
    yes: boolean;
    dryRun: boolean;
}): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    const plan = planUninstall(session, options.keepHooks);
    const lines = [
        'remove',
        ...plan.remove.map((path) => `  ${path}`),
        ...(plan.blocks.length > 0 ? ['managed blocks removed from', ...plan.blocks.map((path) => `  ${path}`)] : []),
        ...(plan.hooksPath ? ['unset core.hooksPath'] : []),
        'kept: gspot.toml and the project rule layer',
        '',
    ];
    if (options.dryRun)
        return { text: `${lines.join('\n')}--dry-run: nothing removed.\n`, json: { plan, dryRun: true }, exitCode: 0 };
    process.stdout.write(lines.join('\n'));
    const go = await askConfirm('Remove these?', '--yes', false, options.yes);
    if (!go) return { text: 'Nothing removed.\n', json: { plan, applied: false }, exitCode: 0 };
    applyUninstall(root, plan);
    return { text: 'removed. gspot.toml stays; delete it to finish.\n', json: { plan, applied: true }, exitCode: 0 };
}

// A tool that keeps its own baseline file prunes it itself.
import { join } from 'node:path';
import { planRun } from '#cli/run/plan.ts';
import { runSideCommand } from '#cli/run/tool-runner.ts';
import type { PlannedCheck, Session } from '#types/run.ts';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { toolBaselineFile } from '#cli/run/scope-paths.ts';

async function pruneOne(session: Session, check: PlannedCheck): Promise<string | undefined> {
    const { spec, scope } = check;
    if (spec.prune_command === undefined || spec.baseline_file === undefined) return undefined;
    const file = join(session.root, toolBaselineFile(spec.baseline_file, scope.scope.path));
    if (!existsSync(file)) return undefined;
    await runSideCommand(session, check, spec.prune_command);
    if (Object.keys(JSON.parse(readFileSync(file, 'utf8')) as object).length === 0) rmSync(file, { force: true });
    const where = scope.scope.path === '' ? '' : ` (${scope.scope.path})`;
    return `${check.id}${where}`;
}

/**
 * A tool that owns its baseline prunes it itself: ESLint drops the suppressions nothing triggers any more.
 * @param session the session
 * @returns the checks whose baseline was pruned
 */
export async function pruneToolBaselines(session: Session): Promise<string[]> {
    const pruned: string[] = [];
    const planned = planRun(session, { stage: 'all', skips: [], localSkips: session.policyFiles.local.skip });
    for (const check of planned) {
        const name = await pruneOne(session, check);
        if (name !== undefined) pruned.push(name);
    }
    return pruned;
}

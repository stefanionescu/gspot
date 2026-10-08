// Sandbox for one fixer check whose fix command each test replaces with its own script.
import { planRun } from '#cli/planning/public.ts';
import { FIXER_POLICY } from '#tests/config/harness/fixer.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';

/**
 * The planned fixer of the sandbox with its command replaced by a script.
 * @param session the open sandbox session
 * @param script the JavaScript the fixer runs
 * @returns the planned check
 */
export function planFixer(session: Session, script: string): PlannedCheck {
    const [planned] = planRun(session, { stage: 'all', skips: [], only: ['sandbox/fixer'] });
    if (planned === undefined) throw new Error('The sandbox has no planned fixer.');
    return { ...planned, check: { ...planned.check, fix: [process.execPath, '-e', script] } };
}

/**
 * Build the shared fixer policy with the executable of the current test process.
 * @param paths the source paths owned by the fixer
 * @returns the policy for an isolated fixer scenario
 */
export function buildFixerPolicy(paths: string[] = ['source.txt']): string {
    return FIXER_POLICY.replaceAll('EXECUTABLE', JSON.stringify(process.execPath)).replaceAll(
        'PATHS',
        JSON.stringify(paths),
    );
}

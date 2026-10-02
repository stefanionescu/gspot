// A planted repository with one correction check whose command each test replaces with its own script.
import type { Session } from '#cli/types/tools/tools.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import type { PlannedCheck } from '#cli/types/execution/execution.ts';

/** A policy with one check whose correction exits 3 until a test gives it a script. */
export const CORRECTION_POLICY = `kits = []
[[check]]
name = "sandbox/correction"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
fix_command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 3'])}
paths = ["source.txt"]
stage = "commit"
`;

/**
 * The planned correction of the sandbox with its command replaced by a script.
 * @param session the open sandbox session
 * @param script the JavaScript the correction runs
 * @returns the planned check
 */
export function plannedCorrection(session: Session, script: string): PlannedCheck {
    const [planned] = planRun(session, { stage: 'all', skips: [] });
    if (planned === undefined) throw new Error('The sandbox has no planned correction.');
    return { ...planned, spec: { ...planned.spec, fix_command: [process.execPath, '-e', script] } };
}

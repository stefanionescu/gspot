// A planted repository with one correction check whose command each test replaces with its own script.
import { planRun } from '#cli/execution/planning/plan.ts';
import type { PlannedCheck, Session } from '#cli/types/execution/execution.ts';

/** A policy with one check whose correction exits 3 until a test gives it a script. */
export const CORRECTION_POLICY = `version = 1
configurations = []
[[check]]
name = "sandbox/correction"
command = ${JSON.stringify([process.execPath, '-e', 'process.exitCode = 0'])}
fix_order = "codemod"
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
export async function plannedCorrection(session: Session, script: string): Promise<PlannedCheck> {
    const [planned] = await planRun(session, { stage: 'all', skips: [] });
    if (planned === undefined) throw new Error('The sandbox has no planned correction.');
    return { ...planned, spec: { ...planned.spec, fix_command: [process.execPath, '-e', script] } };
}

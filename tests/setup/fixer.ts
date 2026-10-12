// Builds the settings and plan for a test fixer.
import { planRun } from '#cli/planning/checks.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
/**
 * The planned fixer of the sandbox with its command replaced by a script.
 * @param session the open sandbox session.
 * @param script the JavaScript the fixer runs.
 * @returns the planned check.
 */
export function planFixer(session: Session, script: string): PlannedCheck {
    const [planned] = planRun(session, { stage: 'all', only: ['sandbox/fixer'] });
    if (planned === undefined) throw new Error('The sandbox has no planned fixer.');
    return { ...planned, check: { ...planned.check, fix: [process.execPath, '-e', script] } };
}

/**
 * Build the shared fixer settings with the executable of the current test process.
 * @param paths the source paths owned by the fixer.
 * @returns the settings for an isolated fixer plan.
 */
export function buildFixerSettings(paths: string[] = ['source.txt']): string {
    return `configurations = []
[[command_check]]
name = "sandbox/fixer"
command = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 0"]
fix = [${JSON.stringify(process.execPath)}, "-e", "process.exitCode = 3"]
paths = ${JSON.stringify(paths)}
stage = "commit"
`;
}

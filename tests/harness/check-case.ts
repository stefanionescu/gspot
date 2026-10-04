// Run one test edit and restore its authored files after success or failure.
import { spawnGspot } from '#tests/harness/gspot.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';
import type { CaseChanges } from '#tests/types/harness/preservation.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';
import type { FindingCase, CheckCommand } from '#tests/types/harness/check-case.ts';

/**
 * Build a clean input, retaining the case's policy and executable paths unless explicitly replaced.
 * @param entry the defect and its explicit correction
 * @param repository the scenario's default correction
 * @returns the corrected inputs for the same check
 */
export function buildCorrection(entry: FindingCase, repository: RepositoryScenario): CaseChanges {
    const given = entry.corrected ?? repository.corrected?.(entry) ?? { files: {} };
    const policy = 'policy' in given ? given.policy : entry.policy;
    const executable = 'executable' in given ? given.executable : entry.executable;
    const kept = { policy, executable, removed: given.removed };
    const defined = Object.entries(kept).filter(([, value]) => value !== undefined);
    return { check: entry.check, files: given.files, ...Object.fromEntries(defined) };
}

/**
 * Applies case changes, runs the selected check, and restores the repository.
 * @param cwd the test repository, already installed
 * @param changes the defect
 * @param environment verbatim variables, such as the PATH of the tools
 * @returns the exit code and the output of the check
 */
export async function runCheckCase(
    cwd: string,
    changes: CaseChanges,
    environment: Record<string, string>,
    run: CheckCommand = spawnGspot,
): Promise<SpawnOutcome> {
    const restore = applyChanges(cwd, changes);
    const argv = ['check', '--only', changes.check, '--json'];
    try {
        return await run(cwd, argv, environment);
    } finally {
        restore();
    }
}

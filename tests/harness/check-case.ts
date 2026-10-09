// Run samples and fixes within the test budget, restoring source-case edits after each run.
import { spawnGspot } from '#tests/harness/gspot.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';
import type { CaseChanges } from '#tests/types/harness/preservation.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
import type { FindingCase, CheckCommand, CheckCaseOutcome } from '#tests/types/harness/check-case.ts';

/**
 * Applies case changes, runs the selected check, and restores the repository.
 * @param cwd the sandbox, already installed
 * @param changes the sample
 * @param environment verbatim variables, such as the PATH of the tools
 * @returns the exit code and the output of the check
 */
export async function runCheckCase(
    cwd: string,
    changes: CaseChanges,
    environment: Record<string, string>,
    run: CheckCommand = spawnGspot,
): Promise<SpawnOutcome> {
    const restore = await applyChanges(cwd, changes);
    const argv = ['check', '--only', changes.check, '--json'];
    try {
        return await run(cwd, argv, environment);
    } finally {
        await restore();
    }
}

/**
 * Observe the sample and its fix, restoring each source edit before returning reports to the test.
 * @param repository the prepared repository and its explicit runner
 * @param entry the sample and expected finding
 * @param scenario the repository's default correction
 * @returns process evidence and parsed reports without asserting their contents
 */
export async function runFindingCase(
    repository: Pick<OwnedTestRepository, 'root' | 'environment' | 'run'>,
    entry: FindingCase,
    scenario: RepositoryScenario,
): Promise<CheckCaseOutcome> {
    const failed = await runCheckCase(repository.root, entry, repository.environment, repository.run);
    const given = entry.corrected ?? scenario.corrected?.(entry) ?? { files: {} };
    const policy = 'policy' in given ? given.policy : entry.policy;
    const executable = 'executable' in given ? given.executable : entry.executable;
    const kept = { policy, executable, removed: given.removed };
    const defined = Object.entries(kept).filter(([, value]) => value !== undefined);
    const corrected = { check: entry.check, files: given.files, ...Object.fromEntries(defined) };
    const passed = await runCheckCase(repository.root, corrected, repository.environment, repository.run);
    return {
        failed: { ...failed, report: JSON.parse(failed.stdout) as RunReport },
        passed: { ...passed, report: JSON.parse(passed.stdout) as RunReport },
    };
}

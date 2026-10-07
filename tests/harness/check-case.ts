// Run defects and corrections within the test budget, restoring source-case edits after each run.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';
import type { CaseChanges } from '#tests/types/harness/preservation.ts';
import type { Consumer, ConsumerOptions } from '#tests/types/harness/consumer.ts';
import type { PackageCheckCase, PackageCheckOutcome } from '#tests/types/packages/check-case.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';
import type { FindingCase, CheckCommand, CheckCaseOutcome } from '#tests/types/harness/check-case.ts';

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

/**
 * Run one delivered check against a defect, apply its correction, and rerun it within the test budget.
 * @param installation the installed CLI command
 * @param options the isolated repository and command environment
 * @param check the defect and the explicit operation that corrects it
 * @returns process evidence and parsed reports for assertions in the owning test
 */
export async function runPackageCheck(
    installation: Pick<Consumer, 'command'>,
    options: ConsumerOptions,
    check: PackageCheckCase,
): Promise<PackageCheckOutcome> {
    const args = [...installation.command, 'check', check.path, '--only', check.only, '--json'];
    if (check.defect !== undefined) writeFileSync(join(options.cwd, check.path), check.defect);
    const failed = await runTestCommand(args, options);
    const report = JSON.parse(failed.stdout) as RunReport;
    let fixed: SpawnOutcome | undefined;
    if ('fix' in check) fixed = await runTestCommand([...args, '--fix'], options);
    else writeFileSync(join(options.cwd, check.path), check.corrected);
    const passed = await runTestCommand(args, options);
    const accepted = JSON.parse(passed.stdout) as RunReport;
    return { failed: { ...failed, report }, fixed, passed: { ...passed, report: accepted } };
}

/**
 * Observe the defect and its correction, restoring each source edit before returning reports to the test.
 * @param repository the prepared repository and its explicit runner
 * @param entry the defect and expected finding
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

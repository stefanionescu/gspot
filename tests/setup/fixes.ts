// Runs one check on a bad sample, then on its fix, and puts the files back.
import { applyChanges } from '#tests/setup/files.ts';
import { markExecutable } from '#tests/setup/git.ts';
import { containing } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import type { SpawnOutcome } from '#tests/types/processes.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { BASH_REPOSITORY } from '#tests/config/bash/sandbox.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';
import type { Sandbox, SandboxPlan } from '#tests/types/sandbox.ts';
import type { GspotCall, SampleFix, CheckSample, SampleChanges, SampleOutcome } from '#tests/types/checks.ts';

/**
 * Applies case changes, runs the selected check, and restores the repository.
 * @param cwd the sandbox, already installed.
 * @param changes the sample.
 * @param environment the command environment, including its executable search path.
 * @returns the exit code and the output of the check.
 */
export async function checkChanges(
    cwd: string,
    changes: SampleChanges,
    environment: Record<string, string>,
    run: GspotCall = spawnGspot,
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
 * @param repository the prepared sandbox and its child process.
 * @param entry the sample and expected finding.
 * @param plan the sandbox's default fix.
 * @returns the verified reports and process results.
 */
export async function runCheckSample(
    repository: Pick<Sandbox, 'root' | 'environment' | 'run'>,
    entry: CheckSample,
    plan: SandboxPlan,
): Promise<SampleOutcome> {
    const failed = await checkChanges(repository.root, entry, repository.environment, repository.run);
    const given: SampleFix = entry.corrected ?? plan.corrected?.(entry) ?? { files: {} };
    const corrected = {
        check: entry.check,
        files: given.files,
        settings: given.settings ?? entry.settings,
        executable: entry.executable,
        removed: given.removed,
    };
    const passed = await checkChanges(repository.root, corrected, repository.environment, repository.run);
    expect(failed.code, `${entry.check}: ${failed.stdout}${failed.stderr}`).toBe(1);
    const failedReport = JSON.parse(failed.stdout) as RunReport;
    expect(failedReport.checks).toContainEqual(containing({ check: entry.check, status: 'failed' }));
    expect(failedReport.checks.flatMap(({ findings }) => findings)).toContainEqual(
        containing({ check: entry.check, ...entry.expected }),
    );
    expect(passed.code, `${entry.check} corrected: ${passed.stdout}${passed.stderr}`).toBe(0);
    const passedReport = JSON.parse(passed.stdout) as RunReport;
    expect(
        passedReport.checks.every(
            ({ check, status, findings }) => check === entry.check && status === 'passed' && findings.length === 0,
        ),
    ).toBe(true);
    return { failed: { ...failed, report: failedReport }, passed: { ...passed, report: passedReport } };
}

/** Register the Bash samples against one sandbox and restore each sample after its check. */
export function runBashSamples(samples: readonly CheckSample[]): void {
    const plan = {
        ...BASH_REPOSITORY,
        corrected: (entry: CheckSample) => ({
            files: Object.fromEntries(Object.keys(entry.files).map((path) => [path, CLEAN_BASH_SCRIPT])),
        }),
    };
    let sandbox: Sandbox;
    beforeAll(async () => {
        sandbox = await createSandbox(plan);
        for (const path of Object.keys(BASH_REPOSITORY.files).filter((path) => path.endsWith('.sh')))
            await markExecutable(sandbox.root, path);
    });
    afterAll(async () => {
        await sandbox[Symbol.asyncDispose]();
    });
    test.each([...samples])('$check reports $expected.rule and passes after the fix', async (entry) => {
        await runCheckSample(sandbox, entry, plan);
    });
}

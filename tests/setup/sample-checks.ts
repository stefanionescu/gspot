// Runs one check on a bad sample, then on its fix, and puts the files back.
import { afterAll, beforeAll } from 'bun:test';
import { markExecutable } from '#tests/setup/git.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import type { Sandbox, SandboxPlan } from '#tests/types/sandbox.ts';
import { createSandbox, changeSandbox } from '#tests/setup/sandbox.ts';
import { BASH_SANDBOX, CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';
import type { Finding, RunReport, CheckResult } from '#cli/types/checks/run/check.ts';

import type {
    GspotCall,
    SampleFix,
    CheckSample,
    SampleResult,
    SampleChanges,
    SampleSummary,
} from '#tests/types/samples.ts';

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
): Promise<ProcessOutput> {
    await using resources = new AsyncDisposableStack();
    // A check writes no generated file, so the restored sandbox needs no apply.
    resources.use(await changeSandbox({ root: cwd, environment, run }, changes));
    const commandArguments = ['check', '--only', changes.check, '--json'];
    return await run(cwd, commandArguments, environment);
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
): Promise<SampleResult> {
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
    const failedReport = JSON.parse(failed.stdout) as RunReport;
    const passedReport = JSON.parse(passed.stdout) as RunReport;
    return { failed: { ...failed, report: failedReport }, passed: { ...passed, report: passedReport } };
}

/** Return plain check outcomes for assertions in the owning test. */
export function summarizeSample(result: SampleResult): SampleSummary {
    return {
        failed: { code: result.failed.code, checks: result.failed.report.checks },
        passed: { code: result.passed.code, checks: result.passed.report.checks },
    };
}

/** Describe the required failed finding and its clean rerun. */
export function expectedSummary(entry: CheckSample): SampleSummary {
    return {
        failed: {
            code: 1,
            checks: matchItems<CheckResult>([
                matchFields<CheckResult>({
                    check: entry.check,
                    status: 'failed',
                    findings: matchItems<Finding>([matchFields<Finding>({ check: entry.check, ...entry.expected })]),
                }),
            ]),
        },
        passed: {
            code: 0,
            checks: matchItems<CheckResult>([
                matchFields<CheckResult>({ check: entry.check, status: 'passed', findings: [] }),
            ]),
        },
    };
}

/** Prepare the Bash suite once and release its sandbox after the owning file's tests. */
export function registerBashSandbox(): () => Sandbox {
    let sandbox: Sandbox;
    beforeAll(async () => {
        sandbox = await createSandbox(BASH_SANDBOX);
        for (const path of Object.keys(BASH_SANDBOX.files).filter((path) => path.endsWith('.sh'))) {
            await markExecutable(sandbox.root, path);
        }
    });
    afterAll(async () => {
        await sandbox[Symbol.asyncDispose]();
    });
    return () => sandbox;
}

/** Calculate the corrected Bash sources and run the broken and corrected forms in the same sandbox. */
export async function runBashSample(sandbox: Sandbox, entry: CheckSample): Promise<SampleResult> {
    return await runCheckSample(sandbox, entry, {
        ...BASH_SANDBOX,
        corrected: (sample) => ({
            files: Object.fromEntries(Object.keys(sample.files).map((path) => [path, CLEAN_BASH_SCRIPT])),
        }),
    });
}

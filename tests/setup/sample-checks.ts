// Runs one check on a bad sample, then on its fix, and puts the files back.
import { afterAll, beforeAll } from 'bun:test';
import { markExecutable } from '#tests/setup/git.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import type { Sandbox, SandboxPlan } from '#tests/types/sandbox.ts';
import { createSandbox, changeSandbox } from '#tests/setup/sandbox.ts';
import type { Finding, RunReport, CheckResult } from '#cli/types/runs/check.ts';
import { BASH_SANDBOX, CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';

import type {
    GspotCall,
    SampleFix,
    CheckSample,
    SampleResult,
    SampleChanges,
    SampleSummary,
} from '#tests/types/samples.ts';

/**
 * Write the sample, run its check, and restore the sandbox.
 *
 * @param cwd the sandbox, already installed.
 * @param changes the sample.
 * @param environment variables for the command, including `PATH`.
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
 * Run the check on the sample and then on its fix, and return both reports.
 *
 * @param repository the installed sandbox and how to run gspot in it.
 * @param entry the sample and expected finding.
 * @param plan what the sandbox holds, with the default fix.
 * @returns both process results and reports.
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

/** Reduce a sample result to exit codes and check results for assertions. */
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

/** Create the Bash sandbox once for a test file and remove it after the tests of that file. */
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

/** Run a Bash sample and its fix in the same sandbox; the fix replaces each file with the clean script. */
export async function runBashSample(sandbox: Sandbox, entry: CheckSample): Promise<SampleResult> {
    return await runCheckSample(sandbox, entry, {
        ...BASH_SANDBOX,
        corrected: (sample) => ({
            files: Object.fromEntries(Object.keys(sample.files).map((path) => [path, CLEAN_BASH_SCRIPT])),
        }),
    });
}

// Runs one check on a bad sample, then on its fix, and puts the files back.
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { afterAll, beforeAll } from 'bun:test';
import { markExecutable } from '#tests/setup/git.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { BASH_SANDBOX } from '#tests/data/checks/bash/samples.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import type { Sandbox, SandboxPlan } from '#tests/types/sandbox.ts';
import type { Finding, CheckResult } from '#cli/types/runs/check.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { createSandbox, changeSandbox, applySandboxChanges } from '#tests/setup/sandbox.ts';

import type {
    GspotCall,
    SampleFix,
    CheckSample,
    SampleResult,
    SampleChanges,
    SampleSummary,
} from '#tests/types/samples.ts';

/**
 * Apply a check sample, run it before and after its fix, and restore its files when the caller leaves its scope.
 *
 * @param sandbox the installed repository and its command runner.
 * @param changes the sample files and settings.
 * @param options the check command and corrected files.
 * @param options.commandArguments the check command and its flags.
 * @param options.corrected the replacement file contents.
 * @returns both captured reports with ownership of the sample's restoration.
 */
export async function runAppliedSample(
    sandbox: Sandbox,
    changes: SampleChanges,
    options: { commandArguments: readonly string[]; corrected: SampleFix['files'] },
): Promise<SampleResult & AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await applySandboxChanges(sandbox, changes));
    const failed = parseCheckReport(await sandbox.run(sandbox.root, options.commandArguments, sandbox.environment));
    for (const [path, source] of Object.entries(options.corrected)) await writeFile(join(sandbox.root, path), source);
    const passed = parseCheckReport(await sandbox.run(sandbox.root, options.commandArguments, sandbox.environment));
    const owned = resources.move();
    return { failed, passed, [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned) };
}

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
 * @param sandbox the installed sandbox and how to run gspot in it.
 * @param entry the sample and expected finding.
 * @param plan what the sandbox holds, with the default fix.
 * @returns both process results and reports.
 */
export async function runCheckSample(sandbox: Sandbox, entry: CheckSample, plan: SandboxPlan): Promise<SampleResult> {
    const failed = parseCheckReport(await checkChanges(sandbox.root, entry, sandbox.environment, sandbox.run));
    const { cleanSource } = plan;
    const given: SampleFix =
        entry.corrected ??
        (cleanSource === undefined
            ? { files: {} }
            : { files: Object.fromEntries(Object.keys(entry.files).map((path) => [path, cleanSource])) });
    const corrected = {
        check: entry.check,
        files: given.files,
        settings: given.settings ?? entry.settings,
        executable: entry.executable,
        removed: given.removed,
    };
    const passed = parseCheckReport(await checkChanges(sandbox.root, corrected, sandbox.environment, sandbox.run));
    const failedReport = failed.report;
    const passedReport = passed.report;
    return { failed: { ...failed, report: failedReport }, passed: { ...passed, report: passedReport } };
}

/** Reduce a sample result to exit codes and check results for assertions. */
export function buildSampleSummary(result: SampleResult): SampleSummary {
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
    let sandbox: Sandbox & AsyncDisposable;
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

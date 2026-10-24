import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { afterAll, beforeAll } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { type Sandbox } from '#tests/types/sandbox.ts';
import type { RunReport } from '#cli/types/runs/run.ts';
import { markExecutable } from '#tests/setup/system/git.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import type { Finding, CheckResult } from '#cli/types/runs/check.ts';
import { BASH_SANDBOX } from '#tests/config/checks/language/bash/sandbox.ts';
import { changeSandbox, applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import type { SampleFix, CheckSample, SampleResult, SampleSummary, SandboxChanges } from '#tests/types/samples.ts';

/**
Apply a check sample, run it before and after its fix, and restore its files when the caller leaves its scope.

@param sandbox the installed repository and its command runner.
@param changes the sample files and settings.
@param options the check command and corrected files.
@param options.commandArguments the check command and its flags.
@param options.corrected the replacement file contents.
@returns both captured reports with ownership of the sample's restoration.
*/
export async function runAppliedSample(
    sandbox: Sandbox,
    changes: SandboxChanges,
    options: { commandArguments: readonly string[]; corrected: SampleFix['files'] },
): Promise<SampleResult & AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await applySandboxChanges(sandbox, changes));
    const failed = parseCheckReport(await sandbox.run(sandbox.root, options.commandArguments));
    for (const [path, source] of Object.entries(options.corrected)) await writeFile(join(sandbox.root, path), source);
    const passed = parseCheckReport(await sandbox.run(sandbox.root, options.commandArguments));
    const owned = resources.move();
    return { failed, passed, [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned) };
}

/**
Write the sample, run its check, and restore the sandbox.

@param sandbox the installed sandbox and its command runner.
@param changes the sample.
@returns the exit code and the output of the check.
*/
export async function runCheckOnChanges(
    sandbox: Sandbox,
    changes: SandboxChanges & { check: string },
): Promise<ProcessOutput> {
    await using resources = new AsyncDisposableStack();
    resources.use(await changeSandbox(sandbox, changes));
    const commandArguments = ['check', '--only', changes.check, '--json'];
    return await sandbox.run(sandbox.root, commandArguments);
}

/**
Run the check on the sample and then on its fix, and return both reports.

@param sandbox the installed sandbox and how to run gspot in it.
@param sample the sample and expected finding.
@param cleanSource the default source used when the sample supplies no fix.
@returns the exit codes and check results before and after the fix.
*/
export async function runCheckSample(
    sandbox: Sandbox,
    sample: CheckSample,
    cleanSource?: string,
): Promise<SampleSummary> {
    const failed = parseCheckReport(await runCheckOnChanges(sandbox, sample));
    const sampleFix: SampleFix = sample.corrected ?? {
        files:
            cleanSource === undefined
                ? {}
                : Object.fromEntries(Object.keys(sample.files).map((path) => [path, cleanSource])),
    };
    const corrected = {
        check: sample.check,
        files: sampleFix.files,
        settings: sampleFix.settings ?? sample.settings,
        executable: sample.executable,
        removed: sampleFix.removed,
    };
    const passed = parseCheckReport(await runCheckOnChanges(sandbox, corrected));
    return {
        failed: { code: failed.code, reported: listReportedChecks(failed.report) },
        passed: { code: passed.code, reported: listReportedChecks(passed.report) },
    };
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function listReportedChecks(report: RunReport): CheckResult[] {
    return report.checks.filter(({ status, findings }) => status !== 'passed' || findings.length > 0);
}

/**
Describe the one failed check result of the sample, with its findings, and its clean rerun.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 31 calls in 31 files share it.
export function expectedSummary(sample: CheckSample): SampleSummary {
    return {
        failed: {
            code: 1,
            reported: [
                matchFields<CheckResult>({
                    check: sample.check,
                    status: 'failed',
                    findings: (sample.findings ?? [sample.expected]).map((finding) =>
                        matchFields<Finding>({ check: sample.check, ...finding }),
                    ),
                }),
            ],
        },
        passed: { code: 0, reported: [] },
    };
}

/**
Create the Bash sandbox once for a test file and remove it after the tests of that file.
*/
export function shareBashSandbox(): () => Sandbox {
    let sandbox: Sandbox & AsyncDisposable;
    beforeAll(async () => {
        sandbox = await createSandbox(BASH_SANDBOX);
        for (const path of Object.keys(BASH_SANDBOX.files)) {
            if (!path.endsWith('.sh')) continue;
            await markExecutable(sandbox.root, path);
        }
    });
    afterAll(async () => {
        await sandbox[Symbol.asyncDispose]();
    });
    return () => sandbox;
}

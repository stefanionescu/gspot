// Runs one check on a bad sample, then on its fix, and puts the files back.
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { afterAll, beforeAll } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { RunReport } from '#cli/types/runs/run.ts';
import { markExecutable } from '#tests/setup/system/git.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import type { Finding, CheckResult } from '#cli/types/runs/check.ts';
import { type Sandbox, type SandboxPlan } from '#tests/types/sandbox.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { BASH_SANDBOX } from '#tests/config/checks/language/bash/sandbox.ts';
import { changeSandbox, applySandboxChanges } from '#tests/setup/sandboxes/changes.ts';

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
export async function runCheckOnChanges(
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
    const failed = parseCheckReport(await runCheckOnChanges(sandbox.root, entry, sandbox.environment, sandbox.run));
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
    const passed = parseCheckReport(await runCheckOnChanges(sandbox.root, corrected, sandbox.environment, sandbox.run));
    return { failed, passed };
}

/** Reduce a sample result to exit codes and the check results that did not pass cleanly. */
export function buildSampleSummary(result: SampleResult): SampleSummary {
    return {
        failed: { code: result.failed.code, reported: listReportedChecks(result.failed.report) },
        passed: { code: result.passed.code, reported: listReportedChecks(result.passed.report) },
    };
}

// The check results of a report that failed or hold a finding.
function listReportedChecks(report: RunReport): CheckResult[] {
    return report.checks.filter(({ status, findings }) => status !== 'passed' || findings.length > 0);
}

/** Describe the one failed check result of the sample, with its findings, and its clean rerun. */
export function expectedSummary(entry: CheckSample): SampleSummary {
    return {
        failed: {
            code: 1,
            reported: [
                matchFields<CheckResult>({
                    check: entry.check,
                    status: 'failed',
                    findings: (entry.findings ?? [entry.expected]).map((finding) =>
                        matchFields<Finding>({ check: entry.check, ...finding }),
                    ),
                }),
            ],
        },
        passed: { code: 0, reported: [] },
    };
}

/** Create the Bash sandbox once for a test file and remove it after the tests of that file. */
export function shareBashSandbox(): () => Sandbox {
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

import { join } from 'node:path';
import { expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { type Sandbox } from '#tests/types/sandbox.ts';
import { type ProcessOutput } from '#tests/types/processes.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { type Finding, type CheckResult } from '#cli/types/runs/check.ts';
import { changeSandbox, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { type SampleFix, type CheckSample, type SampleResult, type SandboxChanges } from '#tests/types/samples.ts';

/**
Apply a check sample, run it before and after its fix, and restore its files when the caller leaves its scope.
*/
export async function runAppliedSample(
    sandbox: Sandbox,
    changes: SandboxChanges,
    options: { commandArguments: readonly string[]; corrected: SampleFix['files'] },
): Promise<SampleResult & AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await writeSandboxChanges(sandbox, changes));
    const failed = parseCheckReport(await sandbox.run(sandbox.root, options.commandArguments));
    for (const [path, source] of Object.entries(options.corrected)) await writeFile(join(sandbox.root, path), source);
    const passed = parseCheckReport(await sandbox.run(sandbox.root, options.commandArguments));
    const owned = resources.move();
    return { failed, passed, [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned) };
}

/**
Write the sample, run its check, and restore the sandbox.
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
Assert that the sample fails with its expected findings and its fix, or cleanSource, passes.
*/
export async function assertCheckSample(sandbox: Sandbox, sample: CheckSample, cleanSource?: string): Promise<void> {
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
    expect({
        failed: {
            code: failed.code,
            reported: failed.report.checks.filter(({ status, findings }) => status !== 'passed' || findings.length > 0),
        },
        passed: {
            code: passed.code,
            reported: passed.report.checks.filter(({ status, findings }) => status !== 'passed' || findings.length > 0),
        },
    }).toStrictEqual({
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
    });
}

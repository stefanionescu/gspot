import { expect } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import type { CheckResult, Finding } from '#cli/types/engine/run.ts';
import { GSPOT_ENVIRONMENT } from '#tests/config/setup/programs.ts';
import { buildRunOptions, createRunResources } from '#tests/setup/cli/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { changeSandbox, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import type { CheckSample, ProcessOutput, SampleFix, Sandbox, SandboxChanges } from '#tests/types/setup.ts';

async function listReportedChecks(
    sandbox: Sandbox,
    sample: SandboxChanges & Pick<CheckSample, 'check' | 'apply'>,
): Promise<CheckResult[]> {
    await using resources = new AsyncDisposableStack();
    const change = sample.apply === true ? writeSandboxChanges : changeSandbox;
    resources.use(await change(sandbox, sample));
    using run = createRunResources();
    using _environment = overrideEnvironment(GSPOT_ENVIRONMENT);
    const session = await openSession(sandbox.root, { resources: run });
    const { report } = await runChecks(session, buildRunOptions({ cwd: sandbox.root, only: [sample.check] }));
    return report.checks.filter(({ status, findings }) => status !== 'passed' || findings.length > 0);
}

export async function runCheckOnChanges(
    sandbox: Sandbox,
    changes: SandboxChanges & { check: string },
): Promise<ProcessOutput> {
    await using resources = new AsyncDisposableStack();
    resources.use(await changeSandbox(sandbox, changes));
    const commandArguments = ['check', '--only', changes.check, '--json'];
    return await sandbox.run(sandbox.root, commandArguments);
}

export async function assertCheckSample(sandbox: Sandbox, sample: CheckSample, cleanSource?: string): Promise<void> {
    const failed = await listReportedChecks(sandbox, sample);
    const sampleFix: SampleFix = sample.corrected ?? {
        files:
            cleanSource === undefined
                ? {}
                : Object.fromEntries(Object.keys(sample.files).map((path) => [path, cleanSource])),
    };
    const passed = await listReportedChecks(sandbox, {
        check: sample.check,
        apply: sample.apply,
        files: sampleFix.files,
        settings: sampleFix.settings ?? sample.settings,
        executable: sample.executable,
        removed: sampleFix.removed,
    });
    expect({ failed, passed }).toStrictEqual({
        failed: [
            matchFields<CheckResult>({
                check: sample.check,
                status: 'failed',
                findings: (sample.findings ?? [sample.expected]).map((finding) =>
                    matchFields<Finding>({ check: sample.check, ...finding }),
                ),
            }),
        ],
        passed: [],
    });
}

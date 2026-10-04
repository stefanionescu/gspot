import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { GENERATED } from '#tests/config/cli/checks/generated-drift.ts';

const GENERATED_DRIFT_OPTIONS = buildRunOptions({ only: ['gspot/drift'] });

test('an edited generated file and one holding merge markers are drift findings, and a fresh apply clears them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'run.sh': '#!/usr/bin/env bash\necho ok\n',
        '.gitignore': '.gspot/state/\n',
    });
    {
        using log = openOwnership(sandbox.path);
        writeOutputs(await openSession(sandbox.path), log);
    }
    const clean = await executeRun(await openSession(sandbox.path), { ...GENERATED_DRIFT_OPTIONS, checks: CHECKS });
    expect(clean.report.checks).toMatchObject([{ check: 'gspot/drift', status: 'passed', findings: [] }]);
    const rendered = readFileSync(join(sandbox.path, GENERATED), 'utf8');
    // Generated files are read-only; the edits below stand for a developer who forced one through.
    chmodSync(join(sandbox.path, GENERATED), 0o644);
    writeFileSync(join(sandbox.path, GENERATED), `${rendered}disable=SC2034\n`);
    const edited = await executeRun(await openSession(sandbox.path), { ...GENERATED_DRIFT_OPTIONS, checks: CHECKS });
    expect(edited.report.exitCode).toBe(1);
    expect(edited.report.checks[0]?.findings).toMatchObject([
        { file: GENERATED, rule: 'changed', help: textContaining('gspot apply') },
    ]);
    writeFileSync(
        join(sandbox.path, GENERATED),
        `<<<<<<< HEAD\n${rendered}=======\n${rendered}disable=SC2034\n>>>>>>> feature\n`,
    );
    const conflicted = await executeRun(await openSession(sandbox.path), {
        ...GENERATED_DRIFT_OPTIONS,
        checks: CHECKS,
    });
    expect(conflicted.report.checks[0]?.findings).toMatchObject([
        {
            file: GENERATED,
            rule: 'conflict',
            message: textContaining('merge conflict markers'),
            help: 'Run gspot apply to write the file again, then gspot install to install what it records.',
        },
    ]);
    {
        using log = openOwnership(sandbox.path);
        writeOutputs(await openSession(sandbox.path), log);
    }
    const repaired = await executeRun(await openSession(sandbox.path), { ...GENERATED_DRIFT_OPTIONS, checks: CHECKS });
    expect(repaired.report.checks[0]).toMatchObject({ status: 'passed', findings: [] });
});

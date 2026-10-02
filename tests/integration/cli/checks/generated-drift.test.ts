import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runOptions } from '#tests/harness/cli/command.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';

const GENERATED_DRIFT_OPTIONS = runOptions({ only: ['gspot/drift'] });

const GENERATED = '.gspot/config/shellcheckrc';

test('an edited generated file and one holding merge markers are drift findings, and a fresh apply clears them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['bash'], '[rules]\ninstall = false\n'),
        'run.sh': '#!/usr/bin/env bash\necho ok\n',
        '.gitignore': '.gspot/state/\n',
    });
    await writeOutputs(await openSession(sandbox.path));
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
    await writeOutputs(await openSession(sandbox.path));
    const repaired = await executeRun(await openSession(sandbox.path), { ...GENERATED_DRIFT_OPTIONS, checks: CHECKS });
    expect(repaired.report.checks[0]).toMatchObject({ status: 'passed', findings: [] });
});

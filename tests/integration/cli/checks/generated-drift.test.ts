import { applyAll } from '#cli/commands/apply/workflow.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { expect, test } from 'bun:test';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const OPTIONS = { stage: 'all' as const, skips: [], only: ['integrity/generated-drift'], fix: false, isDryRun: false };
const GENERATED = '.gspot/config/shellcheckrc';

test('an edited generated file and one holding merge markers are drift findings, and a fresh apply clears them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n',
        'run.sh': '#!/usr/bin/env bash\necho ok\n',
        '.gitignore': '.gspot/cache/\n',
    });
    await applyAll(await openSession(sandbox.path));
    const clean = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(clean.report.checks).toMatchObject([{ check: 'integrity/generated-drift', status: 'ok', findings: [] }]);
    const rendered = readFileSync(join(sandbox.path, GENERATED), 'utf8');
    // Generated files are read-only; the edits below stand for a developer who forced one through.
    chmodSync(join(sandbox.path, GENERATED), 0o644);
    writeFileSync(join(sandbox.path, GENERATED), `${rendered}disable=SC2034\n`);
    const edited = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(edited.report.exitCode).toBe(1);
    expect(edited.report.checks[0]?.findings).toMatchObject([
        { file: GENERATED, rule: 'changed', help: expect.stringContaining('gspot apply') },
    ]);
    writeFileSync(
        join(sandbox.path, GENERATED),
        `<<<<<<< HEAD\n${rendered}=======\n${rendered}disable=SC2034\n>>>>>>> feature\n`,
    );
    const conflicted = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(conflicted.report.checks[0]?.findings).toMatchObject([
        {
            file: GENERATED,
            rule: 'conflict',
            message: expect.stringContaining('merge conflict markers'),
            help: 'Run gspot apply to write the file again, then gspot install to install what it records.',
        },
    ]);
    await applyAll(await openSession(sandbox.path));
    const repaired = await executeRun(await openSession(sandbox.path), OPTIONS);
    expect(repaired.report.checks[0]).toMatchObject({ status: 'ok', findings: [] });
});

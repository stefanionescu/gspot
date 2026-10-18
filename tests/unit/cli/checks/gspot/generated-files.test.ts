import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { RunReport } from '#cli/types/runs/check.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { SHELLCHECK_RC } from '#tests/data/checks/bash/tool-checks.ts';

test('gspot/generated-files reports edited files and apply clears them while tool lockfiles remain missing', async () => {
    const command = ['check', '--only', 'gspot/generated-files', '--json'];
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['bash']),
        'run.sh': '#!/usr/bin/env bash\necho ok\n',
        '.gitignore': '.gspot/state/\n',
    });
    expect(await runGspot(sandbox.path, ['apply'])).toHaveProperty('code', 0);
    const initialCommand = await runGspot(sandbox.path, command);
    const initial = JSON.parse(initialCommand.stdout) as RunReport;
    const missingLocks = initial.checks[0]!.findings;
    expect(missingLocks).toMatchObject([
        { file: '.gspot/package-lock.json', rule: 'missing' },
        { file: '.gspot/uv.lock', rule: 'missing' },
    ]);
    const generated = await readFile(join(sandbox.path, SHELLCHECK_RC), 'utf8');
    await writeFile(join(sandbox.path, SHELLCHECK_RC), `${generated}disable=SC2034\n`);
    const editedCommand = await runGspot(sandbox.path, command);
    const edited = JSON.parse(editedCommand.stdout) as RunReport;
    expect(edited.exitCode).toBe(1);
    expect(edited.checks[0]?.findings.filter(({ file }) => file === SHELLCHECK_RC)).toMatchObject([
        { file: SHELLCHECK_RC, rule: 'changed', help: matchSubstring('gspot apply') },
    ]);
    await writeFile(
        join(sandbox.path, SHELLCHECK_RC),
        `<<<<<<< HEAD\n${generated}=======\n${generated}disable=SC2034\n>>>>>>> feature\n`,
    );
    const conflictedCommand = await runGspot(sandbox.path, command);
    const conflicted = JSON.parse(conflictedCommand.stdout) as RunReport;
    expect(conflicted.checks[0]?.findings.filter(({ file }) => file === SHELLCHECK_RC)).toMatchObject([
        {
            file: SHELLCHECK_RC,
            rule: 'changed',
            message: 'This generated file differs from what gspot.toml generates.',
            help: 'Change settings in gspot.toml, then run gspot apply. gspot replaces the generated files that it owns.',
        },
    ]);
    expect(await runGspot(sandbox.path, ['apply'])).toHaveProperty('code', 0);
    const repairedCommand = await runGspot(sandbox.path, command);
    const repaired = JSON.parse(repairedCommand.stdout) as RunReport;
    expect(repaired.checks[0]).toMatchObject({ status: 'failed', findings: missingLocks });
});

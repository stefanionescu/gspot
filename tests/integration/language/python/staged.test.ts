import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { emitAll } from '#cli/generation/files.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { containing } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { installTools } from '#cli/install/install.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { createPythonSandbox } from '#tests/setup/python.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

test('a staged Python finding is reported by Ruff from the installed environment while the working tree differs', async () => {
    await using repository = await testdir();
    await using prepared = await createPythonSandbox(repository.path, {
        indexFile: 'pyproject.toml',
    });
    {
        using log = openWriter(prepared.root);
        const session = await openSession(prepared.root);
        const installed = await installTools(session, log, emitAll(session));
        expect(installed.exitCode, installed.note).toBe(0);
    }
    // Public apply already generated the Ruff configuration before tool installation.
    commitAll(repository.path);
    // The index holds a second sample beside the committed one; the working tree has the correction.
    await writeFile(join(repository.path, 'source.py'), 'import os\nimport sys\n');
    gitOutput(repository.path, ['add', 'source.py']);
    await writeFile(join(repository.path, 'source.py'), 'VALUE = 1\n');
    const command = ['check', '--only', 'python/ruff', '--json'];
    const staged = await spawnGspot(repository.path, [...command, '--staged']);
    expect(staged.code, staged.stdout + staged.stderr).toBe(1);
    const report = JSON.parse(staged.stdout) as RunReport;
    expect(report.checks).toMatchObject([
        {
            check: 'python/ruff',
            status: 'failed',
            findings: [
                containing({ file: 'source.py', line: 1, rule: 'F401' }),
                containing({ file: 'source.py', line: 2, rule: 'F401' }),
            ],
        },
    ]);
    const working = await spawnGspot(repository.path, command);
    expect(working.code, working.stdout + working.stderr).toBe(0);
    expect((JSON.parse(working.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/ruff', status: 'passed' },
    ]);
});

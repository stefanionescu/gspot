import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createPythonProject } from '#tests/setup/sandboxes/projects/python.ts';

test('Ruff from the installed environment reports a staged Python finding while the working tree differs', async () => {
    await using sandbox = await testdir();
    await using project = await createPythonProject(sandbox.path, { indexFile: 'pyproject.toml' });
    expect(await spawnGspot(project.root, ['install'])).toMatchObject({ code: 0 });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'source.py'), 'import os\nimport sys\n');
    runGitStep(sandbox.path, ['add', 'source.py']);
    await writeFile(join(sandbox.path, 'source.py'), 'VALUE = 1\n');
    const command = ['check', '--only', 'python/ruff', '--json'];
    const staged = parseCheckReport(await spawnGspot(sandbox.path, [...command, '--staged']));
    expect(staged.code, staged.stdout + staged.stderr).toBe(1);
    expect(staged.report.checks).toMatchObject([
        {
            check: 'python/ruff',
            status: 'failed',
            findings: [
                matchFields({ file: 'source.py', line: 1, rule: 'F401' }),
                matchFields({ file: 'source.py', line: 2, rule: 'F401' }),
            ],
        },
    ]);
    const working = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(working.code, working.stdout + working.stderr).toBe(0);
    expect(working.report.checks).toMatchObject([{ check: 'python/ruff', status: 'passed' }]);
});

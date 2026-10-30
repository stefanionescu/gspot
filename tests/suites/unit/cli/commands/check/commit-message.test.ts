import executables from 'which';
import { join, parse } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { fakeNpmTool } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { testModules } from '#tests/setup/sandboxes/node-modules.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('check --hook commit-msg passes a conventional message and leaves it unchanged', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['commits'], { level: 'all' }),
        'message.txt': 'fix: preserve the commit message\n',
    });
    await fakeNpmTool(sandbox.path, 'commitlint');
    const spawn = processes.spawnProcess;
    using _command = spyOn(processes, 'spawnProcess').mockImplementation((command, options) =>
        spawn(
            parse(command[0]!).name === 'commitlint'
                ? [executables.sync('commitlint', { path: join(testModules, '.bin') }), ...command.slice(1)]
                : command,
            options,
        ),
    );
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code).toBe(0);
    const result = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--hook', 'commit-msg', '--json', '--', 'message.txt']),
    );
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.report.checks.map(({ check, status, findings }) => ({ check, status, findings }))).toStrictEqual([
        { check: 'commits/commitlint', status: 'passed', findings: [] },
        { check: 'commits/references', status: 'passed', findings: [] },
    ]);
    expect(await readFile(join(sandbox.path, 'message.txt'), 'utf8')).toBe('fix: preserve the commit message\n');
});

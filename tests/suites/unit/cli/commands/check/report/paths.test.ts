import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('check prints no path of the repository root without --verbose, and each command with it', async () => {
    const crash = buildProgramCommand('fakes/tool', '--stderr', 'Cannot read {root}/settings.json', '--exit', '2');
    const finding = buildProgramCommand('fakes/tool', '--line', '{root}/source.txt is wrong', '--exit', '1');
    const tables = stringify({
        command_check: [
            { id: 'project/crash', stage: 'commit', paths: ['source.txt'], command: crash },
            {
                id: 'project/finding',
                stage: 'commit',
                paths: ['source.txt'],
                command: finding,
                output: { format: 'regex', pattern: '(?<message>.+)' },
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables }),
        'source.txt': 'Input.\n',
    });
    const selection = ['check', '--only', 'project/crash,project/finding'];
    const text = await runGspot(sandbox.path, selection);
    expect(text.code, text.stdout + text.stderr).toBe(2);
    expect(text.stdout).toContain('source.txt is wrong');
    expect(text.stdout + text.stderr).not.toContain(sandbox.path);
    const json = parseCheckReport(await runGspot(sandbox.path, [...selection, '--json']));
    expect(json.stdout).not.toContain(sandbox.path);
    expect(json.report.checks.map(({ command }) => command)).toStrictEqual([undefined, undefined]);
    const verbose = parseCheckReport(await runGspot(sandbox.path, [...selection, '--json', '--verbose']));
    expect(verbose.report.checks.find(({ check }) => check === 'project/finding')?.command).toContain(
        `${sandbox.path}/source.txt is wrong`,
    );
});

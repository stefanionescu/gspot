import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('staged error notes and command arguments name the working root instead of the copy', async () => {
    const command = buildProgramCommand('fakes/tool', '--stderr', 'Cannot read {root}/settings.json', '--exit', '2');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/path-error',
                        stage: 'commit',
                        paths: ['source.txt'],
                        command,
                    },
                ],
            }),
        }),
        'source.txt': 'input',
    });
    runGitStep(sandbox.path, ['add', '-A']);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--staged', '--only', 'project/path-error', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(checked.report.checks[0]!.note).toContain(`Cannot read ${sandbox.path}/settings.json`);
    expect(checked.report.checks[0]!.command).toStrictEqual(
        command.map((argument) => argument.replaceAll('{root}', sandbox.path)),
    );
});

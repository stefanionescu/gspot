import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { parseBashScript } from '#cli/parsers/code/bash.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a reproduction quotes a check name and protects a path beginning with a dash', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/check$literal',
                        stage: 'commit',
                        paths: ['*.txt'],
                        command: buildProgramCommand('fakes/tool', '--line', 'A finding.', '--exit', '1', '{file}'),
                        output: { format: 'lines' },
                    },
                ],
            }),
        }),
        '-entry.txt': 'input',
    });
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', './-entry.txt', '--only', 'project/check$literal', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const command = checked.report.checks[0]!.reproduce!;
    expect(command).toBe("gspot check ./-entry.txt --only 'project/check$literal'");
    const parsed = await parseBashScript(command);
    const reproducedArguments = parsed.commands[0]!.arguments;
    expect(reproducedArguments.every((argument) => typeof argument === 'string')).toBe(true);
    const repeated = parseCheckReport(await runGspot(sandbox.path, [...(reproducedArguments as string[]), '--json']));
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    expect(repeated.report.checks.flatMap(({ findings }) => findings)).toStrictEqual(
        checked.report.checks.flatMap(({ findings }) => findings),
    );
});

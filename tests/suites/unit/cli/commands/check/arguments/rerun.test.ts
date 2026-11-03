import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { runGitStep } from '#tests/setup/system/git.ts';
import { parseBashScript } from '#cli/parsers/code/bash.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const FIXABLE_CHECK = stringify({
    command_check: [
        {
            id: 'project/fixable',
            stage: 'commit',
            paths: ['*.txt'],
            command: buildProgramCommand('fakes/tool', '--line', 'broken.txt', '--exit', '1'),
            fix: buildProgramCommand('fakes/tool', '--text', 'fixed\n', '{files}'),
            output: { format: 'regex', pattern: '(?<file>.+)', fixable: 'broken' },
        },
    ],
});

test('a rerun line quotes a check name and protects a path beginning with a dash', async () => {
    const tables = stringify({
        command_check: [
            {
                id: 'project/check$literal',
                stage: 'commit',
                paths: ['*.txt'],
                command: buildProgramCommand('fakes/tool', '--line', 'A finding.', '--exit', '1', '{file}'),
                output: { format: 'regex', pattern: '(?<message>.+)' },
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables }),
        '-entry.txt': 'input',
    });
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', './-entry.txt', '--only', 'project/check$literal', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const command = checked.report.checks[0]!.rerun!;
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

test('a fixable finding prints the fix command of its check, and that command changes only the reported file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: FIXABLE_CHECK }),
        'broken.txt': 'input\n',
        'other.txt': 'input\n',
    });
    runGitStep(sandbox.path, ['add', '-A']);
    const printed = await runGspot(sandbox.path, ['check', '--staged']);
    const command = 'gspot check --fix --only project/fixable broken.txt';
    expect(printed.stdout).toContain(`  fix: ${command}\n`);
    const parsed = await parseBashScript(command);
    await runGspot(sandbox.path, parsed.commands[0]!.arguments as string[]);
    expect(await readFile(join(sandbox.path, 'broken.txt'), 'utf8')).toBe('fixed\n');
    expect(await readFile(join(sandbox.path, 'other.txt'), 'utf8')).toBe('input\n');
});

test('a fixable finding in a file with merge-conflict markers prints no fix command', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: FIXABLE_CHECK }),
        'broken.txt': 'one\n<<<<<<< HEAD\ntwo\n=======\nthree\n>>>>>>> branch\n',
    });
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'project/fixable', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks[0]).not.toHaveProperty('fixCommand');
});

test('a run of every file prints the fix command without files when the fix covers each reported file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: FIXABLE_CHECK }),
        'broken.txt': 'input\n',
        'other.txt': 'input\n',
    });
    const printed = await runGspot(sandbox.path, ['check', '--only', 'project/fixable']);
    expect(printed.code, printed.stdout + printed.stderr).toBe(1);
    expect(printed.stdout).toContain('  fix: gspot check --fix --only project/fixable\n');
});

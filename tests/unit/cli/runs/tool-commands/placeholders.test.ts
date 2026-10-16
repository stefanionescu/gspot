import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { planRun } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/checks/run/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { symlink, writeFile } from 'node:fs/promises';
import { spawnProcess } from '#cli/system/processes.ts';
import { checkInput } from '#cli/checks/run/built-in.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { type CommandPart } from '#cli/types/checks/run/command.ts';
import { WORKSPACE_SCOPE_CASES } from '#tests/data/runs/command-checks.ts';
import { listSwiftlintToolFiles } from '#cli/checks/language/swift/build.ts';
import { prepareCommand, buildCommandEnvironment } from '#cli/checks/run/command/check.ts';
import { expandCommand, listScratchFiles, buildFileInvocations } from '#cli/checks/run/command/placeholders.ts';

test('a whole setting preserves empty and multiword command arguments', async () => {
    await using sandbox = await testdir();
    const commandArguments = [process.execPath, 'generate.ts', '', 'two words'];
    const runner = [
        process.execPath,
        '-e',
        `process.exitCode = JSON.stringify(process.argv.slice(-4)) === ${JSON.stringify(JSON.stringify(commandArguments))} ? 0 : 1`,
        '--',
    ];
    const settings = {
        configurations: ['openapi'],
        openapi: { document: 'openapi.json', generate_command: commandArguments },
        command_check: [
            {
                name: 'sandbox/arguments',
                command: [...runner, '{setting:openapi.generate_command}'],
                paths: ['openapi.json'],
                stage: 'push',
            },
        ],
        rules: { enabled: false },
    };
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify(settings),
        'openapi.json': '{}\n',
    });
    const result = await checkReport(sandbox.path, ['check', '--only', 'sandbox/arguments', '--json']);
    expect(result.code, result.stderr).toBe(0);
    expect(result.report.checks).toMatchObject([
        {
            check: 'sandbox/arguments',
            status: 'passed',
            command: [...runner, ...commandArguments],
        },
    ]);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        stringify({
            ...settings,
            command_check: [
                {
                    ...settings.command_check[0],
                    command: [...runner, 'prefix{setting:openapi.generate_command}'],
                },
            ],
        }),
    );
    await verifyInlineCommand(sandbox.path);
    await verifyEmptyCommand(
        sandbox.path,
        stringify({
            ...settings,
            openapi: { ...settings.openapi, generate_command: [] },
        }),
    );
});

test('tool file inputs of a nested scope stop at the scope folder and follow a link inside the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['swift'], { tables: '[[scope]]\npath = "app"\n' }),
        '.swiftlint.yml': 'disabled_rules: []\n',
        'app/.swiftlint.yml': 'disabled_rules: []\n',
        'app/Sources/.swiftlint.yml': 'disabled_rules: []\n',
        'app/Sources/Feature/One.swift': 'let one = 1\n',
        'app/Sources/Feature/Two.swift': 'let two = 2\n',
        'app/Other/.swiftlint.yml': 'disabled_rules: []\n',
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', only: ['swift/swiftlint'] });
    const planned = plans.find((plan) => plan.scope.scope.path === 'app')!;
    expect(listSwiftlintToolFiles(checkInput(session, planned))).toStrictEqual([
        '.gspot/config/swiftlint.yml',
        'app/.swiftlint.yml',
        'app/Sources/.swiftlint.yml',
    ]);
    await symlink('../.swiftlint.yml', join(sandbox.path, 'app/Sources/Feature/.swiftlint.yml'));
    expect(listSwiftlintToolFiles(checkInput(session, planned))).toStrictEqual([
        '.gspot/config/swiftlint.yml',
        'app/.swiftlint.yml',
        'app/Sources/.swiftlint.yml',
        'app/Sources/Feature/.swiftlint.yml',
    ]);
});

test.each([...WORKSPACE_SCOPE_CASES])(
    'workspace expansion retains arguments only for a package scope: $scope',
    async ({ scope, expected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['swift']),
            'Example.swift': 'let example = 1\n',
            'package.json': '{}',
            'package/package.json': '{}',
            'source/Example.swift': 'let source = 2\n',
        });
        const session = await openSession(sandbox.path);
        const plans = planRun(session, { stage: 'commit', only: ['swift/swiftlint'] });
        expect(
            expandCommand(session, plans[0]!, ['before', '{workspace:--workspace}', 'after'], {
                files: [],
                scope,
                root: sandbox.path,
                indent: 4,
            }),
        ).toStrictEqual(['before', ...expected, 'after']);
    },
);

test.each([0, 1, 2])('replaces a file marker at position %s without dropping neighboring arguments', (slot) => {
    const parts: CommandPart[] = ['before', 'after'];
    parts.splice(slot, 0, { file: true });
    const commands = buildFileInvocations(parts, ['one.txt', 'café folder/two.txt']);
    for (const [index, file] of ['one.txt', 'café folder/two.txt'].entries()) {
        const expected = ['before', 'after'];
        expected.splice(slot, 0, file);
        expect(commands[index]).toStrictEqual({ commandArguments: expected, file });
    }
});

test('a Markdown command run in a scratch copy keeps the tool files its manifest writes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['markdown']),
        'README.md': '# Example\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', only: ['markdown/markdownlint'] })[0]!;
    const paths = listScratchFiles(session, planned, planned.check.command!);
    expect(paths).toContain('.gspot/config/markdownlint-cli2.mjs');
    expect(paths).toContain('.gspot/config/markdownlint.jsonc');
    expect(paths).toContain('README.md');
    expect(() => listScratchFiles(session, planned, ['markdownlint-cli2', '{tool_file:absent}'])).toThrow(
        'Check markdown/markdownlint names {tool_file:absent} and no configuration writes it.',
    );
});

test('per-file commands keep expanded flags and the arguments after the file', async () => {
    const settings = `configurations = []
[[command_check]]\nname = "sandbox/arguments"
command = ${JSON.stringify([process.execPath, 'echo.cjs', '{existing:--config:settings.txt}', '{file}', 'config', '--quiet'])}
paths = ["inputs/**"]
stage = "commit"
`;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'settings.txt': '',
        'inputs/café source.txt': '',
        'echo.cjs': 'process.stdout.write(JSON.stringify([process.env.TOOL_RELEASE, ...process.argv.slice(2)]));',
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'all', only: ['sandbox/arguments'] });
    const planned = plans[0]!;
    planned.tool = { name: 'echo', installers: {}, kind: 'program', env: { TOOL_RELEASE: 'v3.4.0' } };
    const prepared = prepareCommand(planned, {
        session,
        command: planned.check.command!,
        environment: buildCommandEnvironment(session, planned, {}),
        toolPath: process.execPath,
    });
    const result = await spawnProcess(prepared.commands[0]!.commandArguments, {
        cwd: prepared.cwd,
        env: prepared.env,
    });
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual([
        'v3.4.0',
        '--config',
        join(sandbox.path, 'settings.txt'),
        'inputs/café source.txt',
        'config',
        '--quiet',
    ]);
});

test('a command keeps a declared empty argument in its place', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: [],
            command_check: [
                {
                    name: 'project/arguments',
                    command: [
                        process.execPath,
                        '-e',
                        'process.exitCode = process.argv.at(-1) === "" ? 0 : 1',
                        '--',
                        '',
                    ],
                    paths: ['source.txt'],
                    stage: 'commit',
                },
            ],
        }),
        'source.txt': 'source input',
    });
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/arguments'] }));
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks).toMatchObject([{ check: 'project/arguments', status: 'passed' }]);
});

test.each([
    { style: 'space', width: 6, expected: '6' },
    { style: 'tab', width: 6, expected: '0' },
])('format $style indentation supplies shfmt -i $expected', async ({ style, width, expected }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['format', 'bash'], {
            level: 'all',
            tables: `[format]
indent_style = "${style}"
indent_width = ${String(width)}
`,
        }),
        'sample.sh': 'echo example\n',
    });
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'all', only: ['bash/shfmt'] });
    const command = prepareCommand(planned!, {
        session,
        command: planned!.check.command!,
        environment: buildCommandEnvironment(session, planned!, {}),
        toolPath: process.execPath,
    });
    expect(command.commandArguments[command.commandArguments.indexOf('-i') + 1]).toBe(expected);
});

/** Check that the public schema refuses an empty command setting. */
async function verifyEmptyCommand(root: string, settings: string): Promise<void> {
    await writeFile(join(root, 'gspot.toml'), settings);
    const empty = await runGspot(root, ['check', '--only', 'sandbox/arguments', '--json']);
    expect(empty.code).toBe(2);
    expect(JSON.parse(empty.stdout)).toMatchObject({
        error: 'settings',
        message: expect.stringContaining('openapi.generate_command') as unknown,
    });
}

/** Check that a list setting cannot expand inside one command argument. */
async function verifyInlineCommand(root: string): Promise<void> {
    const inline = await checkReport(root, ['check', '--only', 'sandbox/arguments', '--json']);
    expect(inline.code).toBe(2);
    expect(inline.report.checks).toMatchObject([
        {
            check: 'sandbox/arguments',
            status: 'error',
            note: expect.stringContaining(
                'List setting openapi.generate_command must occupy a whole command argument.',
            ) as unknown,
        },
    ]);
}

import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/checks/run/run.ts';
import { openSession } from '#cli/commands/session.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { type CommandPart } from '#cli/types/execution/command.ts';
import { WORKSPACE_SCOPE_CASES } from '#tests/config/execution.ts';
import { checkInput, runBuiltInCheck } from '#cli/checks/run/built-in.ts';
import { swiftlintConfigurationFiles } from '#cli/checks/language/swift/build.ts';
import { checkStaleGeneratorOutputs } from '#cli/checks/stale-generator-outputs.ts';
import { prepareCommand, commandEnvironment } from '#cli/checks/run/command/check.ts';
import { substitute, scratchFiles, perFileCommands } from '#cli/checks/run/command/placeholders.ts';

{
    test('a whole setting preserves empty and multiword command arguments', async () => {
        const scope = '';
        const level = 'recommended';
        await using sandbox = await testdir();
        const table = '[openapi]';
        const argv = ['bun', 'generate.ts', '', 'two words'];
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['openapi'], {
                level,
                tables: `${table}\ndocument = "openapi.json"\ngenerate_command = ${JSON.stringify(argv)}\n`,
            }),
            [join(scope, 'openapi.json')]: '{}\n',
        });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'openapi/stale-document', { scope });
        const planned = planRun(session, { stage: 'push', only: ['openapi/stale-document'] }).find(
            (entry) => entry.scope.scope.path === scope,
        )!;
        const environment = commandEnvironment(session, planned);
        expect(prepareCommand(session, planned, input.check.command!, environment).commands[0]?.argv).toStrictEqual(
            argv,
        );
        expect(() =>
            prepareCommand(session, planned, ['prefix{setting:openapi.generate_command}'], environment),
        ).toThrow('List setting openapi.generate_command must occupy a whole command argument.');
        input.scope.view.settings['openapi.generate_command'] = [];
        expect(prepareCommand(session, planned, input.check.command!, environment).commands[0]?.argv).toStrictEqual([]);
        const checked = await runBuiltInCheck(checkStaleGeneratorOutputs)(session, planned);
        expect(checked.findings).toStrictEqual([]);
    });
}
{
    test('tool file inputs of a nested scope stop at the scope folder and follow a link inside the repository', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['swift'], { tables: '[[scope]]\npath = "app"\n' }),
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
        expect(swiftlintConfigurationFiles(checkInput(session, planned))).toStrictEqual([
            '.gspot/config/app/swiftlint.yml',
            'app/.swiftlint.yml',
            'app/Sources/.swiftlint.yml',
        ]);
        await symlink('../.swiftlint.yml', join(sandbox.path, 'app/Sources/Feature/.swiftlint.yml'));
        expect(swiftlintConfigurationFiles(checkInput(session, planned))).toStrictEqual([
            '.gspot/config/app/swiftlint.yml',
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
                'gspot.toml': settingsText(['swift']),
                'Example.swift': 'let example = 1\n',
                'package.json': '{}',
                'package/package.json': '{}',
                'source/Example.swift': 'let source = 2\n',
            });
            const session = await openSession(sandbox.path);
            const plans = planRun(session, { stage: 'commit', only: ['swift/swiftlint'] });
            expect(
                substitute(session, plans[0]!, ['before', '{workspace:--workspace}', 'after'], {
                    files: [],
                    scope,
                    root: sandbox.path,
                    indent: 4,
                }),
            ).toStrictEqual(['before', ...expected, 'after']);
        },
    );
}
{
    test.each([0, 1, 2])('replaces a file marker at position %s without dropping neighboring arguments', (slot) => {
        const parts: CommandPart[] = ['before', 'after'];
        parts.splice(slot, 0, { file: true });
        const commands = perFileCommands(parts, ['one.txt', 'café folder/two.txt']);
        for (const [index, file] of ['one.txt', 'café folder/two.txt'].entries()) {
            const expected = ['before', 'after'];
            expected.splice(slot, 0, file);
            expect(commands[index]).toStrictEqual({ argv: expected, file });
        }
    });

    test('a Markdown command run in a scratch copy keeps the tool files its manifest writes', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['markdown']),
            'README.md': '# Example\n',
        });
        const session = await openSession(sandbox.path);
        const planned = planRun(session, { stage: 'commit', only: ['markdown/markdownlint'] })[0]!;
        const paths = scratchFiles(session, planned, planned.check.command!);
        expect(paths).toContain('.gspot/config/markdownlint-cli2.mjs');
        expect(paths).toContain('.gspot/config/markdownlint.jsonc');
        expect(paths).toContain('README.md');
        expect(() => scratchFiles(session, planned, ['markdownlint-cli2', '{tool_file:absent}'])).toThrow(
            'Check markdown/markdownlint names {tool_file:absent} and no configuration writes it.',
        );
    });
}
{
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
        const prepared = prepareCommand(session, planned, planned.check.command!, commandEnvironment(session, planned));
        const result = await spawnProcess(prepared.commands[0]!.argv, { cwd: prepared.cwd, env: prepared.env });
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
        const result = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['project/arguments'] }),
        );
        expect(result.report.exitCode).toBe(0);
        expect(result.report.checks).toMatchObject([{ check: 'project/arguments', status: 'passed' }]);
    });
}

test("format.indent_width supplies shfmt's -i argument", async () => {
    const width = 6;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['format', 'bash'], {
            level: 'all',
            tables: `[format]
indent_width = ${String(width)}
`,
        }),
        'sample.sh': 'echo example\n',
    });
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'all', only: ['bash/shfmt'] });
    const command = prepareCommand(session, planned!, planned!.check.command!, commandEnvironment(session, planned!));
    expect(command.argv[command.argv.indexOf('-i') + 1]).toBe(String(width));
});

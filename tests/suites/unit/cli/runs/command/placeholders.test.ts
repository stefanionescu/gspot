import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { planChecks } from '#cli/planning/checks.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { type CommandPart } from '#cli/types/runs/command.ts';
import { findFileTarget } from '#tests/setup/cli/config-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { prepareCommand, buildCommandSetup } from '#cli/runs/command/check.ts';
import { expandCommand, listCopyFiles, buildFileCommandLines } from '#cli/runs/command/placeholders.ts';

import {
    ARGUMENT_RUNNER,
    SHFMT_INDENT_CASES,
    GENERATE_ARGUMENTS,
    WORKSPACE_SCOPE_CASES,
} from '#tests/config/runs/command.ts';

/** Write gspot.toml with an openapi.generate_command list and a check that runs this command. */
async function writeListSetting(root: string, command: readonly string[], generate: readonly string[]): Promise<void> {
    const tables = stringify({
        openapi: { document: 'openapi.json', generate_command: [...generate] },
        command_check: [{ id: 'sandbox/arguments', command: [...command], paths: ['openapi.json'], stage: 'push' }],
    });
    await createFileTree(root, { 'gspot.toml': buildSandboxSettings(['openapi'], { tables }), 'openapi.json': '{}\n' });
}

test('a whole list setting expands into separate command arguments, keeping empty and multiword ones', async () => {
    await using sandbox = await testdir();
    await writeListSetting(
        sandbox.path,
        [...ARGUMENT_RUNNER, '{setting:openapi.generate_command}'],
        GENERATE_ARGUMENTS,
    );
    const result = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'sandbox/arguments', '--json']));
    expect(result.code, result.stderr).toBe(0);
    expect(result.report.checks).toMatchObject([
        { check: 'sandbox/arguments', status: 'passed', command: [...ARGUMENT_RUNNER, ...GENERATE_ARGUMENTS] },
    ]);
});

test('a list setting inside one command argument is refused', async () => {
    await using sandbox = await testdir();
    await writeListSetting(
        sandbox.path,
        [...ARGUMENT_RUNNER, 'prefix{setting:openapi.generate_command}'],
        GENERATE_ARGUMENTS,
    );
    const inline = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'sandbox/arguments', '--json']));
    expect(inline.code).toBe(2);
    expect(inline.report.checks.map(({ check, status, note }) => ({ check, status, note }))).toStrictEqual([
        {
            check: 'sandbox/arguments',
            status: 'error',
            note: 'The sandbox/arguments check failed: List setting openapi.generate_command must occupy a whole command argument.',
        },
    ]);
});

test('an empty list setting is refused as a settings error', async () => {
    await using sandbox = await testdir();
    await writeListSetting(sandbox.path, [...ARGUMENT_RUNNER, '{setting:openapi.generate_command}'], []);
    const empty = await runGspot(sandbox.path, ['check', '--only', 'sandbox/arguments', '--json']);
    expect(empty.code).toBe(2);
    expect(JSON.parse(empty.stdout)).toStrictEqual({
        error: 'settings',
        message: 'gspot.toml: openapi.generate_command: Too small: expected array to have >=1 items',
    });
});
test.each([...WORKSPACE_SCOPE_CASES])(
    'workspace expansion retains arguments only for a package scope: $scope',
    async ({ scope, expected }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['swift']),
            'Example.swift': 'let example = 1\n',
            'package.json': '{}',
            'package/package.json': '{}',
            'source/Example.swift': 'let source = 2\n',
        });

        const session = await openSession(sandbox.path);
        const plans = planChecks(session, { stage: 'commit', only: ['swift/swiftlint'] });
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

test.each([0, 1, 2])(
    'a {file} placeholder at position %s is replaced without dropping neighboring arguments',
    (slot) => {
        const parts: CommandPart[] = ['before', 'after'];
        parts.splice(slot, 0, { file: true });
        const commands = buildFileCommandLines(parts, ['one.txt', 'café folder/two.txt']);
        for (const [index, file] of ['one.txt', 'café folder/two.txt'].entries()) {
            const expected = ['before', 'after'];
            expected.splice(slot, 0, file);
            expect(commands[index]).toStrictEqual({ commandArguments: expected, file });
        }
    },
);

test('a Markdown command run in a copy keeps the config files its manifest writes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'README.md': '# Example\n',
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['markdown/markdownlint'] })[0]!;
    expect(listCopyFiles(session, planned, planned.check.command!)).toStrictEqual([
        'README.md',
        findFileTarget('markdown', 'markdownlint-cli2.mjs'),
        findFileTarget('markdown', 'markdownlint.jsonc'),
    ]);
    expect(() => listCopyFiles(session, planned, ['markdownlint-cli2', '{config_file:absent}'])).toThrow(
        'Check markdown/markdownlint names {config_file:absent} and no configuration writes it.',
    );
});

test('per-file commands keep expanded flags and the arguments after the file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'sandbox/arguments',
                        command: [
                            process.execPath,
                            'echo.cjs',
                            '{existing:--config:settings.txt}',
                            '{file}',
                            'config',
                            '--quiet',
                        ],
                        paths: ['inputs/**'],
                        stage: 'commit',
                    },
                ],
            }),
        }),
        'settings.txt': '',
        'inputs/café source.txt': '',
        'echo.cjs': 'process.stdout.write(JSON.stringify([process.env.TOOL_RELEASE, ...process.argv.slice(2)]));',
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'all', only: ['sandbox/arguments'] })[0]!;
    planned.tool = { name: 'echo', installers: {}, kind: 'program' };
    planned.check.env = { TOOL_RELEASE: 'v3.4.0' };
    const prepared = prepareCommand(planned, {
        session,
        command: planned.check.command!,
        setup: buildCommandSetup(session, planned, {}),
        toolPath: process.execPath,
    });
    const result = await spawnProcess(prepared.commandLines[0]!.commandArguments, {
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

test.each([...SHFMT_INDENT_CASES])(
    'format $style indentation supplies shfmt -i $expected',
    async ({ style, width, expected }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['format', 'bash'], {
                level: 'all',
                tables: stringify({ format: { indent_style: style, indent_width: width } }),
            }),
            'sample.sh': 'echo example\n',
        });

        const session = await openSession(sandbox.path);
        const [planned] = planChecks(session, { stage: 'all', only: ['bash/shfmt'] });
        const command = prepareCommand(planned!, {
            session,
            command: planned!.check.command!,
            setup: buildCommandSetup(session, planned!, {}),
            toolPath: process.execPath,
        });
        expect(command.commandArguments[command.commandArguments.indexOf('-i') + 1]).toBe(expected);
    },
);
test('a command check accepts an {existing} config file that links to a file inside the repository', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'project/linked-config',
                        paths: ['*.swift'],
                        stage: 'commit',
                        command: [process.execPath, '-e', 'process.exitCode = 0', '{existing:--config:.swiftlint.yml}'],
                        output: { format: 'lines' },
                    },
                ],
            }),
        }),
        'source.swift': 'let value = 1\n',
        'settings/swiftlint.yml': 'disabled_rules: []\n',
    });

    await symlink('settings/swiftlint.yml', join(sandbox.path, '.swiftlint.yml'));
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'project/linked-config', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

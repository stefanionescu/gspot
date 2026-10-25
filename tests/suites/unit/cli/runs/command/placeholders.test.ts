import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { stringify } from '@decimalturn/toml-patch';
import { planChecks } from '#cli/planning/checks.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { type CommandArgument } from '#cli/types/runs/command.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { prepareCommand, buildCommandSetup } from '#cli/runs/command/check.ts';
import { expandCommand, listCopyFiles, buildFileCommandLines } from '#cli/runs/command/placeholders.ts';

import {
    ARGUMENT_RUNNER,
    SHFMT_INDENT_CASES,
    GENERATE_ARGUMENTS,
    WORKSPACE_SCOPE_CASES,
} from '#tests/config/runs/command.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in this file share it.
async function writeListSetting(root: string, command: readonly string[], generate: readonly string[]): Promise<void> {
    const tables = stringify({
        openapi: { document: 'openapi.json', generate_command: [...generate] },
        command_check: [{ id: 'sandbox/arguments', command: [...command], paths: ['openapi.json'], stage: 'push' }],
    });
    await createFileTree(root, { 'gspot.toml': buildSandboxSettings(['openapi'], { tables }), 'openapi.json': '{}\n' });
}

test('a whole list setting expands into separate command arguments, keeping empty and multiword ones', async () => {
    await using sandbox = await createGitSandbox({});
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
    await using sandbox = await createGitSandbox({});
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
    await using sandbox = await createGitSandbox({});
    await writeListSetting(sandbox.path, [...ARGUMENT_RUNNER, '{setting:openapi.generate_command}'], []);
    const empty = await runGspot(sandbox.path, ['check', '--only', 'sandbox/arguments', '--json']);
    expect(empty.code).toBe(2);
    expect(JSON.parse(empty.stdout)).toStrictEqual({
        error: 'settings',
        message:
            'gspot.toml:5: openapi.generate_command: The value [] is not valid for openapi.generate_command. Use a valid list value: The command that writes the OpenAPI document from the code, run in the project scope folder.',
    });
});

test.each([...WORKSPACE_SCOPE_CASES])(
    'workspace expansion keeps arguments only for a package scope: $scope',
    async ({ scope, expected }) => {
        await using sandbox = await createGitSandbox({
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
    'a {file} placeholder at position %p is replaced without dropping neighboring arguments',
    (slot) => {
        const command: CommandArgument[] = ['before', 'after'];
        command.splice(slot, 0, { file: true });
        const commands = buildFileCommandLines(command, ['one.txt', 'café folder/two.txt']);
        for (const [index, file] of ['one.txt', 'café folder/two.txt'].entries()) {
            const expected = ['before', 'after'];
            expected.splice(slot, 0, file);
            expect(commands[index]).toStrictEqual({ commandArguments: expected, file });
        }
    },
);

test('a Markdown command run in a copy keeps the config files its manifest writes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'README.md': '# Example\n',
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['markdown/markdownlint'] })[0]!;
    expect(listCopyFiles(session, planned, planned.check.command!)).toStrictEqual([
        'README.md',
        findManifestTarget('markdown', 'markdownlint-cli2.mjs'),
        findManifestTarget('markdown', 'markdownlint.jsonc'),
    ]);
    expect(() => listCopyFiles(session, planned, ['markdownlint-cli2', '{config_file:absent}'])).toThrow(
        'Check markdown/markdownlint names {config_file:absent} and no configuration writes it.',
    );
});

test('per-file commands keep the arguments after the file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'sandbox/arguments',
                        command: buildProgramCommand(
                            'processes/call',
                            '--environment',
                            'TOOL_RELEASE',
                            '--',
                            '{file}',
                            'config',
                            '--quiet',
                        ),
                        paths: ['inputs/**'],
                        stage: 'commit',
                    },
                ],
            }),
        }),
        'inputs/café source.txt': '',
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'all', only: ['sandbox/arguments'] })[0]!;
    planned.tool = { name: 'echo', installers: {}, kind: 'program' };
    planned.check.env = { TOOL_RELEASE: 'v3.4.0' };
    const setup = prepareCommand(planned, {
        session,
        command: planned.check.command!,
        setup: buildCommandSetup(session, planned, { options: {}, root: session.root }),
        toolPath: process.execPath,
    });
    const result = await spawnProcess(setup.commandLines[0]!.commandArguments, {
        cwd: setup.cwd,
        env: setup.env,
    });
    expect(result.code, result.stderr).toBe(0);
    const call = JSON.parse(result.stdout) as { arguments: string[]; environment: Record<string, string | null> };
    expect({ arguments: call.arguments, environment: call.environment }).toStrictEqual({
        arguments: ['inputs/café source.txt', 'config', '--quiet'],
        environment: { TOOL_RELEASE: 'v3.4.0' },
    });
});

test.each([...SHFMT_INDENT_CASES])(
    'format $style indentation supplies shfmt -i $expected',
    async ({ style, width, expected }) => {
        await using sandbox = await createGitSandbox({
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
            setup: buildCommandSetup(session, planned!, { options: {}, root: session.root }),
            toolPath: process.execPath,
        });
        expect(command.commandArguments[command.commandArguments.indexOf('-i') + 1]).toBe(expected);
    },
);

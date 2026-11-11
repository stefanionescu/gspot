import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GENERATED_HEADER_TEXT } from '#cli/config/generation.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { buildCheckSession } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildCommandLaunch } from '#cli/engine/tool-runs/check.ts';
import { expandCommand, listCopyFiles, replacePlaceholders } from '#cli/engine/tool-runs/placeholders.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { runProcess } from '#cli/system/processes.ts';
import { CAFE_SOURCE_PATH, GENERATE_ARGUMENTS, WORKSPACE_SCOPE_CASES } from '#tests/config/engine/tool-runs.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { CHECK_GENERATION } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

async function writeListSetting(root: string, placeholder: string, generateCommand: readonly string[]): Promise<void> {
    const command = [
        ...buildProgramCommand('checks/arguments', '--equals', JSON.stringify(GENERATE_ARGUMENTS), '--'),
        placeholder,
    ];
    const tables = stringify({
        openapi: { document: 'openapi.json', generate_command: [...generateCommand] },
        command_check: [{ id: 'sandbox/arguments', command, paths: ['openapi.json'], stage: 'push' }],
    });
    await createFileTree(root, { 'gspot.toml': buildSandboxSettings(['openapi'], { tables }), 'openapi.json': '{}\n' });
}

test('a list setting expands into one command argument per value, keeping empty and multiword ones', async () => {
    await using sandbox = await createGitSandbox({});
    await writeListSetting(sandbox.path, '{setting:openapi.generate_command}', GENERATE_ARGUMENTS);
    const result = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/arguments', '--json', '--verbose']),
    );
    expect(result.code, result.stderr).toBe(0);
    expect(result.report.checks).toMatchObject([
        {
            check: 'sandbox/arguments',
            status: 'passed',
            command: [
                ...buildProgramCommand('checks/arguments', '--equals', JSON.stringify(GENERATE_ARGUMENTS), '--'),
                ...GENERATE_ARGUMENTS,
            ],
        },
    ]);
});

test('a list setting inside one command argument is refused', async () => {
    await using sandbox = await createGitSandbox({});
    await writeListSetting(sandbox.path, 'prefix{setting:openapi.generate_command}', GENERATE_ARGUMENTS);
    const inline = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'sandbox/arguments', '--json']));
    expect(inline.code).toBe(2);
    expect(inline.report.checks.map(({ check, status, note }) => ({ check, status, note }))).toStrictEqual([
        {
            check: 'sandbox/arguments',
            status: 'error',
            note: expect.stringContaining('openapi.generate_command') as string,
        },
    ]);
});

test.each([...WORKSPACE_SCOPE_CASES])(
    'workspace expansion keeps arguments only for a workspace package scope: $scopePath',
    async ({ scopePath, expected }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift']),
            'Example.swift': 'let example = 1\n',
            'package.json': '{"workspaces":["package"]}',
            'package/package.json': '{"name":"workspace"}',
            'docs/package.json': '{"name":"docs"}',
            'source/Example.swift': 'let source = 2\n',
        });

        const session = buildCheckSession(await openSession(sandbox.path), CHECK_GENERATION);
        const plans = planChecks(session, { stage: 'commit', only: ['swift/swiftlint'] });
        expect(
            expandCommand(session, plans[0]!, ['before', '{workspace:--workspace}', 'after'], {
                files: [],
                scopePath,
                root: sandbox.path,
            }),
        ).toStrictEqual(['before', ...expected, 'after']);
    },
);

test('a Markdown command run in a copy keeps the config files its manifest writes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'README.md': '# Example\n',
    });

    const session = buildCheckSession(await openSession(sandbox.path), CHECK_GENERATION);
    const planned = planChecks(session, { stage: 'commit', only: ['markdown/markdownlint'] })[0]!;
    expect(listCopyFiles(session, planned, planned.check.command!)).toStrictEqual([
        'README.md',
        getManifestTarget('markdown', 'markdownlint-cli2.mjs'),
        getManifestTarget('markdown', 'markdownlint.jsonc'),
    ]);
    expect(() => listCopyFiles(session, planned, ['markdownlint-cli2', '{config_file:absent}'])).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message: expect.stringContaining('{config_file:absent}') as string,
        }),
    );
});

test('per-file commands keep the arguments after the file', async () => {
    const command = buildProgramCommand(
        'fakes/tool',
        '--record',
        '-',
        '--environment',
        'TOOL_RELEASE',
        '--',
        '{file}',
        'config',
        '--quiet',
    );
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [{ id: 'sandbox/arguments', command, paths: ['inputs/**'], stage: 'commit' }],
            }),
        }),
        'inputs/café source.txt': '',
    });

    const session = buildCheckSession(await openSession(sandbox.path), CHECK_GENERATION);
    const planned = planChecks(session, { stage: 'all', only: ['sandbox/arguments'] })[0]!;
    planned.check = { ...planned.check, env: { TOOL_RELEASE: 'v3.4.0' } };
    const setup = buildCommandLaunch(planned, {
        session,
        command: planned.check.command!,
        root: session.root,
        tool: { name: 'echo', installers: {}, kind: 'program' },
        toolPath: process.execPath,
    });
    const result = await runProcess(setup.commandLines[0]!.commandArguments, {
        cwd: setup.cwd,
        env: setup.env,
    });
    expect(result.code, result.stderr).toBe(0);
    const call = JSON.parse(result.stdout) as { arguments: string[]; environment: Record<string, string | null> };
    expect({ arguments: call.arguments, environment: call.environment }).toStrictEqual({
        arguments: [CAFE_SOURCE_PATH, 'config', '--quiet'],
        environment: { TOOL_RELEASE: 'v3.4.0' },
    });
});

test('scalar placeholders select generated pointer files, scope, and boolean settings', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift'], { scopes: [{ path: 'app' }] }),
        'app/main.swift': 'let value = 1\n',
        'prettier.config.mjs': `// ${GENERATED_HEADER_TEXT}\nexport default {};\n`,
    });
    let session = buildCheckSession(await openSession(sandbox.path), CHECK_GENERATION);
    let planned = planChecks(session, { stage: 'all', only: ['swift/swiftlint'] }).find(
        ({ scope }) => scope.path === 'app',
    )!;
    const substitutions = { scopePath: 'app', files: [], root: sandbox.path };
    expect(replacePlaceholders(session, planned, '{pointer:prettier.config.mjs}', substitutions)).toBe(
        'prettier.config.mjs',
    );
    planned.scope.settings.valuesByKey['enabled'] = true;
    expect(replacePlaceholders(session, planned, '{setting:enabled}', substitutions)).toBe('true');
    expect(replacePlaceholders(session, planned, '{scope}', { ...substitutions, scopePath: '' })).toBe('.');
    await createFileTree(sandbox.path, {
        'app/prettier.config.mjs': `// ${GENERATED_HEADER_TEXT}\nexport default {};\n`,
    });
    session = buildCheckSession(await openSession(sandbox.path), CHECK_GENERATION);
    planned = planChecks(session, { stage: 'all', only: ['swift/swiftlint'] }).find(
        ({ scope }) => scope.path === 'app',
    )!;
    expect(replacePlaceholders(session, planned, '{pointer:prettier.config.mjs}', substitutions)).toBe(
        join('app', 'prettier.config.mjs'),
    );
});

test('a setting value that holds a placeholder stays literal', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo ready\n',
    });
    const session = buildCheckSession(await openSession(sandbox.path), CHECK_GENERATION);
    const planned = planChecks(session, { stage: 'all', only: ['bash/shellcheck'] })[0]!;
    planned.scope.settings.valuesByKey['example'] = '{root}/{scope}/{config_file:shellcheckrc}';
    const substitutions = { scopePath: 'app', files: [], root: sandbox.path };
    expect(replacePlaceholders(session, planned, '{root}:{setting:example}', substitutions)).toBe(
        `${sandbox.path}:{root}/{scope}/{config_file:shellcheckrc}`,
    );
});

test('editorconfig-checker leaves out the extensions of the selected formatters', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'main.py': 'value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const [planned] = planChecks(session, { stage: 'all', only: ['format/editorconfig-checker'] });
    const excluded = replacePlaceholders(
        buildCheckSession(session, CHECK_GENERATION),
        planned as NonNullable<typeof planned>,
        '{formatted_extensions}',
        { files: [], scopePath: '', root: sandbox.path },
    );
    expect(excluded.split(/[.(|)$]+/u)).toContain('py');
    expect(excluded.split(/[.(|)$]+/u)).not.toContain('swift');
    expect(excluded.split(/[.(|)$]+/u)).toContain('toml');
});

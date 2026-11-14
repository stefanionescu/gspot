import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { openSession } from '#cli/engine/session.ts';
import { planChecks } from '#cli/engine/plan/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { CHECK_GENERATION } from '#cli/generation/stale.ts';
import { WORKSPACE_SCOPE_CASES } from '#tests/config/engine/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { buildCommandLaunch } from '#cli/engine/run/tool-runs/check.ts';
import { runChecks, buildCheckSession } from '#cli/engine/run/checks.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { GENERATED_HEADER_TEXT } from '#cli/config/generation/builders.ts';
import { expandCommand, replacePlaceholders } from '#cli/engine/run/tool-runs/placeholders.ts';

const GENERATE_ARGUMENTS = [process.execPath, 'generate.ts', '', 'two words'];

async function writeListSetting(root: string, placeholder: string): Promise<void> {
    const tables = stringify({
        openapi: { document: 'openapi.json', generate_command: GENERATE_ARGUMENTS },
        command_check: [
            {
                id: 'sandbox/arguments',
                command: [...buildProgramCommand('fakes/tool'), placeholder],
                paths: ['openapi.json'],
                stage: 'push',
            },
        ],
    });
    await createFileTree(root, { 'gspot.toml': buildSandboxSettings(['openapi'], { tables }), 'openapi.json': '{}\n' });
}

test('a list setting expands into one command argument per value, keeping empty and multiword ones', async () => {
    await using sandbox = await createGitSandbox({});
    await writeListSetting(sandbox.path, '{setting:openapi.generate_command}');
    const session = buildCheckSession(await openSession(sandbox.path), CHECK_GENERATION);
    const planned = planChecks(session, { stage: 'push', only: ['sandbox/arguments'] })[0]!;
    expect(
        expandCommand(session, planned, ['before', '{setting:openapi.generate_command}'], {
            files: [],
            scopePath: '',
            root: sandbox.path,
        }),
    ).toStrictEqual(['before', ...GENERATE_ARGUMENTS]);
});

test('a list setting inside one command argument is refused', async () => {
    await using sandbox = await createGitSandbox({});
    await writeListSetting(sandbox.path, 'prefix{setting:openapi.generate_command}');
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['sandbox/arguments'] }),
    );
    expect(report.exitCode).toBe(2);
    expect(report.checks.map(({ check, status, note }) => ({ check, status, note }))).toStrictEqual([
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

test('per-file commands keep the arguments after the file', async () => {
    const command = buildProgramCommand('fakes/tool', '{file}', 'config', '--quiet');
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
    expect(setup.commandLines[0]?.commandArguments.slice(-3)).toStrictEqual([
        'inputs/café source.txt',
        'config',
        '--quiet',
    ]);
    expect(setup.env['TOOL_RELEASE']).toBe('v3.4.0');
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

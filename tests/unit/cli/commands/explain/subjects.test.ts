import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { type PathExplanation } from '#cli/types/commands/explain.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';
import { EXPLAIN_SETTINGS, CHECK_TOOL_MINIMUMS, CONFIGURATION_DETECTION_LINES } from '#tests/data/commands/explain.ts';

test('a path explanation lists the command checks and the ignores that apply', async () => {
    await using sandbox = await testdir();
    const tables = `[[command_check]]
name = "project/syntax"
command = ["bash", "-n", "{files}"]
paths = ["**/*.sh"]
stage = "manual"
`;
    const settings = buildSandboxSettings([], { rules: true, scopes: [{ path: 'api', configurations: [] }], tables });
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            scopes: [{ path: 'api', configurations: [] }],
            tables,
            ignore: { checks: ['project/syntax'], reason: 'The sandbox tests a disabled check.' },
        }),
        'api/build.sh': CLEAN_BASH_SCRIPT,
    });
    const ignored = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(ignored.code).toBe(0);
    expect(JSON.parse(ignored.stdout)).toMatchObject({
        ignores: [{ check: 'project/syntax', reason: 'The sandbox tests a disabled check.' }],
    });
    await writeFile(join(sandbox.path, 'gspot.toml'), settings);
    const corrected = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout)).toMatchObject({
        checks: matchItems([matchFields({ check: 'project/syntax', stage: 'manual' })]),
        ignores: [],
    });
    expect(JSON.parse(corrected.stdout)).not.toHaveProperty('unchecked');
    const command = await runGspot(sandbox.path, ['explain', 'project/syntax', '--json']);
    expect(command.code, command.stdout + command.stderr).toBe(0);
    expect(JSON.parse(command.stdout)).toMatchObject({
        kind: 'check',
        check: 'project/syntax',
        stage: 'manual',
        command: ['bash', '-n', '{files}'],
        paths: ['**/*.sh'],
    });
    const remaining = (JSON.parse(ignored.stdout) as PathExplanation).checks;
    expect(remaining.map((entry) => entry.check)).not.toContain('project/syntax');
    expect(remaining.map((entry) => entry.check)).toContain('format/editorconfig-checker');
});
test('a configuration name stays a name, and a tracked or ./ path explains the file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': EXPLAIN_SETTINGS,
        bash: CLEAN_BASH_SCRIPT,
        'api/build.sh': CLEAN_BASH_SCRIPT,
        'shellcheck/run.sh': CLEAN_BASH_SCRIPT,
    });

    commitAll(sandbox.path);
    const configuration = await runGspot(sandbox.path, ['explain', 'bash', '--json']);
    expect(configuration.code, configuration.stdout + configuration.stderr).toBe(0);
    expect(JSON.parse(configuration.stdout)).toMatchObject({
        kind: 'configuration',
        subject: 'bash',
        title: 'Shell scripts',
    });
    const file = await runGspot(sandbox.path, ['explain', './bash', '--json']);
    expect(file.code, file.stdout + file.stderr).toBe(0);
    expect(JSON.parse(file.stdout)).toMatchObject({ kind: 'path', subject: 'bash', path: 'bash' });
    // The shellcheck folder shares a check's tool name; the tracked path still selects the file.
    const tracked = await runGspot(sandbox.path, ['explain', 'shellcheck/run.sh', '--json']);
    expect(tracked.code, tracked.stdout + tracked.stderr).toBe(0);
    expect(JSON.parse(tracked.stdout)).toMatchObject({ kind: 'path', subject: 'shellcheck/run.sh' });
});
test('a file path reports its scope, checks, and ignores', async () => {
    await using sandbox = await testdir({
        'gspot.toml': EXPLAIN_SETTINGS,
        'api/build.sh': CLEAN_BASH_SCRIPT,
    });

    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        kind: 'path',
        subject: 'api/build.sh',
        path: 'api/build.sh',
        scope: 'api',
        fileKind: 'source',
        configurations: matchItems(['bash']),
        checks: matchItems([{ check: 'bash/shellcheck', stage: 'commit', configuration: 'bash' }]),
        ignores: [
            {
                check: 'bash/shellcheck',
                rule: 'SC2086',
                reason: 'The script deliberately splits a list of arguments.',
            },
        ],
    });
});
test.each([
    ['./missing.sh', 'missing.sh'],
    ['unknown-configuration', 'gspot cannot explain unknown-configuration.'],
])('explain of %s fails with an arguments error that names the subject', async (subject, message) => {
    await using sandbox = await testdir({ 'gspot.toml': EXPLAIN_SETTINGS, 'api/build.sh': CLEAN_BASH_SCRIPT });

    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['explain', subject, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining(message) as string,
    });
});
test.each([
    ['bash', 'configuration'],
    ['bash/shellcheck', 'check'],
] as const)('configuration and check explanations still resolve without settings (%j)', async (subject, kind) => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });

    commitAll(sandbox.path);

    const result = await runGspot(sandbox.path, ['explain', subject, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ kind, subject });
});

test.each([...CONFIGURATION_DETECTION_LINES])(
    'explain $configuration lists the detection rules and file tags',
    async ({ configuration, lines }) => {
        await using sandbox = await testdir({ 'README.md': '# Example\n' });
        const result = await runGspot(sandbox.path, ['explain', configuration]);
        expect({ code: result.code, stderr: result.stderr }).toStrictEqual({ code: 0, stderr: '' });
        expect(
            result.stdout.split('\n').filter((line) => line.startsWith('Detected by:') || line.startsWith('Files:')),
        ).toStrictEqual([...lines]);
    },
);

test.each([...CHECK_TOOL_MINIMUMS])(
    'explain <check> lists the minimum versions of the tools that the check runs, not of every tool of its configuration: $check',
    async ({ check, tools }) => {
        await using sandbox = await testdir();
        const configurations = readConfigurations();
        const expected = tools.map((name) => {
            const minimum = getTool(configurations.values(), name).min_version;
            return `Needs ${name} ${String(minimum)} or newer`;
        });
        const result = await runGspot(sandbox.path, ['explain', check]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout.split('\n').filter((line) => line.startsWith('Needs '))).toStrictEqual(expected);
    },
);

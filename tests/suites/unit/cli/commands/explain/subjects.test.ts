import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { getTool } from '#cli/configurations/tools.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { type PathExplanation } from '#cli/types/commands/explain.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/checks/language/bash/sandbox.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';

import {
    PATH_IGNORES,
    EXPLAIN_SETTINGS,
    SYNTAX_CHECK_TABLES,
    CHECK_TOOL_MINIMUMS,
    UNKNOWN_SUBJECT_CASES,
    SYNTAX_CHECK_EXPLANATION,
    CONFIGURATION_DETECTION_LINES,
} from '#tests/config/commands/explain/subjects.ts';

test('a path explanation lists the command checks and the ignores that apply', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--quiet']);
    const settings = buildSandboxSettings([], {
        rules: true,
        scopes: [{ path: 'api', configurations: [] }],
        tables: SYNTAX_CHECK_TABLES,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            scopes: [{ path: 'api', configurations: [] }],
            tables: SYNTAX_CHECK_TABLES,
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
    const explanation = JSON.parse(corrected.stdout) as PathExplanation;
    expect(explanation.ignores).toStrictEqual([]);
    expect(explanation.checks.find(({ check }) => check === 'project/syntax')).toStrictEqual({
        check: 'project/syntax',
        stage: 'manual',
    });
    expect(JSON.parse(corrected.stdout)).not.toHaveProperty('unchecked');
    const command = await runGspot(sandbox.path, ['explain', 'project/syntax', '--json']);
    expect(command.code, command.stdout + command.stderr).toBe(0);
    expect(JSON.parse(command.stdout)).toMatchObject(SYNTAX_CHECK_EXPLANATION);
    expect((JSON.parse(ignored.stdout) as PathExplanation).checks).toStrictEqual(
        explanation.checks.filter(({ check }) => check !== 'project/syntax'),
    );
});

test('a configuration name stays a name, and a tracked or ./ path explains the file', async () => {
    await using sandbox = await createGitSandbox({
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
    const tracked = await runGspot(sandbox.path, ['explain', 'shellcheck/run.sh', '--json']);
    expect(tracked.code, tracked.stdout + tracked.stderr).toBe(0);
    expect(JSON.parse(tracked.stdout)).toMatchObject({ kind: 'path', subject: 'shellcheck/run.sh' });
});

test.each(['run.sh', './run.sh', '../src/run.sh'])('explain resolves %s from its calling folder', async (subject) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': 'printf "root\\n"\n',
        'src/run.sh': 'printf "source\\n"\n',
    });
    const cwd = join(sandbox.path, 'src');
    const before = await runGspot(cwd, ['explain', subject, '--json']);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    expect(JSON.parse(before.stdout)).toMatchObject({ kind: 'path', subject: 'src/run.sh', path: 'src/run.sh' });
    await unlink(join(sandbox.path, 'run.sh'));
    const after = await runGspot(cwd, ['explain', subject, '--json']);
    expect(after.code, after.stdout + after.stderr).toBe(0);
    expect(JSON.parse(after.stdout)).toStrictEqual(JSON.parse(before.stdout));
});

test('a file path reports its scope, checks, and ignores', async () => {
    await using sandbox = await testdir({
        'gspot.toml': EXPLAIN_SETTINGS,
        'api/build.sh': CLEAN_BASH_SCRIPT,
    });

    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const explanation = JSON.parse(result.stdout) as PathExplanation;
    expect(explanation).toMatchObject({
        kind: 'path',
        subject: 'api/build.sh',
        path: 'api/build.sh',
        scope: 'api',
        fileKind: 'source',
        ignores: [...PATH_IGNORES],
    });
    expect(explanation.configurations).toStrictEqual(['format', 'prose', 'secrets', 'security', 'spelling', 'bash']);
    expect(explanation.checks.filter(({ configuration }) => configuration === 'bash')).toStrictEqual(
        ['shellcheck', 'shfmt', 'unused-functions', 'unread-arguments', 'safety'].map((name) => ({
            check: `bash/${name}`,
            stage: 'commit',
            configuration: 'bash',
        })),
    );
});

test.each([...UNKNOWN_SUBJECT_CASES])(
    'explain of %s fails with an arguments error that names the subject',
    async (subject, message) => {
        await using sandbox = await testdir({ 'gspot.toml': EXPLAIN_SETTINGS, 'api/build.sh': CLEAN_BASH_SCRIPT });

        commitAll(sandbox.path);
        const result = await runGspot(sandbox.path, ['explain', subject, '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(JSON.parse(result.stdout)).toStrictEqual({ error: 'arguments', message });
    },
);

test.each([...CONFIGURATION_DETECTION_LINES])(
    'explain $configuration lists the detection rules and file tags',
    async ({ configuration, lines }) => {
        await using sandbox = await testdir({ 'README.md': '# Example\n' });
        runGitStep(sandbox.path, ['init', '--quiet']);
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
        runGitStep(sandbox.path, ['init', '--quiet']);
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

import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { readConfigurations } from '#cli/manifests/read.ts';
import { pathOutputSchema } from '#cli/schemas/commands.ts';
import { getTool } from '#cli/tools/pins.ts';
import {
    CHECK_TOOL_MINIMUMS,
    EXPLAIN_SETTINGS,
    PATH_IGNORES,
    SYNTAX_CHECK_TABLES,
    UNKNOWN_SUBJECT_CASES,
} from '#tests/config/commands/reports.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

test('a path explanation names its scope and kind, and shows the checks that the level turns off', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': 'echo example\n',
    });
    const result = await runGspot(sandbox.path, ['explain', './run.sh']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('run.sh  (scope ., kind source');
    expect(result.stdout).toMatch(/^ {2}bash\/shellcheck {2}\w+ {2}on$/mu);
    expect(result.stdout).toMatch(/^ {2}\S+ {2}\w+ {2}skipped \(level\)$/mu);
});

test('explain asks before it offers to ignore a check', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const result = await runGspot(sandbox.path, ['explain', 'bash/shellcheck']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const lines = result.stdout.split('\n');
    const question = lines.indexOf('Ask the user before you ignore a check.');
    expect(question).toBeGreaterThan(-1);
    expect(lines[question + 1]).toStartWith('Ignore it for some paths: gspot ignore bash/shellcheck');
});

test('a path explanation lists the command checks and the ignores that apply', async () => {
    await using sandbox = await createGitSandbox({});
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
    const explanation = pathOutputSchema.parse(JSON.parse(corrected.stdout));
    expect(explanation.ignores).toStrictEqual([]);
    expect(explanation.checks.find(({ check }) => check === 'project/syntax')).toStrictEqual({
        check: 'project/syntax',
        stage: 'manual',
        state: 'on',
    });
    expect(JSON.parse(corrected.stdout)).not.toHaveProperty('unchecked');
    expect(pathOutputSchema.parse(JSON.parse(ignored.stdout)).checks.map(({ check }) => check)).toStrictEqual(
        explanation.checks.map(({ check }) => check),
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

test.each(['run.sh', './run.sh'])('explain resolves %s from its calling folder', async (subject) => {
    await using sandbox = await createGitSandbox({
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
    const explanation = pathOutputSchema.parse(JSON.parse(result.stdout));
    expect(explanation).toMatchObject({
        kind: 'path',
        subject: 'api/build.sh',
        path: 'api/build.sh',
        scope: 'api',
        fileKind: 'source',
        ignores: [...PATH_IGNORES],
    });
});

test.each([...UNKNOWN_SUBJECT_CASES])(
    'explain of %s fails with an arguments error that names the subject',
    async (subject, message) => {
        await using sandbox = await testdir({ 'gspot.toml': EXPLAIN_SETTINGS, 'api/build.sh': CLEAN_BASH_SCRIPT });

        commitAll(sandbox.path);
        const result = await runGspot(sandbox.path, ['explain', subject, '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments', message });
    },
);

test.each([...CHECK_TOOL_MINIMUMS])(
    'explain <check> lists the minimum versions of the tools that the check runs, not of every tool of its configuration: $check',
    async ({ check, tools }) => {
        await using sandbox = await createGitSandbox({});
        const configurationsByName = readConfigurations();
        const expected = tools.map((name) => {
            const minimum = getTool(configurationsByName.values(), name).min_version;
            return `Needs ${name} ${String(minimum)} or newer.`;
        });
        const result = await runGspot(sandbox.path, ['explain', check]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout.split('\n').filter((line) => line.startsWith('Needs '))).toStrictEqual(expected);
    },
);

test('explain of a check says whether its configuration is selected and names the add command', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': 'echo example\n',
    });
    const selected = await runGspot(sandbox.path, ['explain', 'bash/shellcheck']);
    expect({ code: selected.code, stderr: selected.stderr }).toStrictEqual({ code: 0, stderr: '' });
    expect(selected.stdout.split('\n').filter((line) => line.startsWith('Selected in this repository:'))).toStrictEqual(
        ['Selected in this repository: yes'],
    );
    const unselected = await runGspot(sandbox.path, ['explain', 'docker/hadolint']);
    expect({ code: unselected.code, stderr: unselected.stderr }).toStrictEqual({ code: 0, stderr: '' });
    expect(
        unselected.stdout.split('\n').filter((line) => line.startsWith('Selected in this repository:')),
    ).toStrictEqual(['Selected in this repository: no (gspot add docker)']);
});

test.each([
    { subject: ['bash/shellcheck'], fields: { kind: 'check', selected: true } },
    { subject: ['data-files/yaml', 'documents'], fields: { kind: 'lint-rule' } },
])('explain --json carries each command that its text prints: $subject', async ({ subject, fields }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash', 'data-files']) });
    const text = await runGspot(sandbox.path, ['explain', ...subject]);
    const json = await runGspot(sandbox.path, ['explain', ...subject, '--json']);
    expect(json.code, json.stderr).toBe(0);
    const commands = text.stdout
        .split('\n')
        .flatMap((line) => /: (?<command>gspot .+)$/u.exec(line)?.groups?.['command'] ?? []);
    expect(commands.length).toBeGreaterThan(1);
    for (const command of commands) expect(json.stdout).toContain(JSON.stringify(command).slice(1, -1));
    expect(JSON.parse(json.stdout)).toMatchObject(fields);
});

test('explain --json reports every field of a configuration', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['explain', 'engineering', '--json']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        name: 'engineering',
        group: 'general',
        requires: [],
        tools: [],
        checks: [{ check: 'engineering/nested-agents-files', stage: 'commit' }],
        settingNames: [],
        ruleFiles: [],
        alwaysSelected: true,
        removed: [],
        kind: 'configuration',
        subject: 'engineering',
    });
});

test('explain names the ignores of a check and the removals of a configuration, with the command that undoes each', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], {
            tables: [
                '[removed_configurations]',
                'markdown = "The project keeps no Markdown files."',
                '[[ignore]]',
                'check = "bash/shellcheck"',
                'rule = "SC2086"',
                'paths = ["entry.sh"]',
                'reason = "The script splits words on purpose."',
                '[[ignore]]',
                'check = "bash/shellcheck"',
                'reason = "Upstream checks these scripts."',
                '',
            ].join('\n'),
        }),
        'entry.sh': CLEAN_BASH_SCRIPT,
    });
    const check = await runGspot(sandbox.path, ['explain', 'bash/shellcheck']);
    expect(check.code, check.stdout + check.stderr).toBe(0);
    expect(check.stdout).toEndWith(
        [
            'Ignored in this repository:',
            '  rule SC2086 in entry.sh: The script splits words on purpose.  (undo: gspot unignore bash/shellcheck --rule SC2086 --paths entry.sh)',
            '  everywhere: Upstream checks these scripts.  (undo: gspot unignore bash/shellcheck)',
            '',
        ].join('\n'),
    );
    const configuration = await runGspot(sandbox.path, ['explain', 'markdown']);
    expect(configuration.code, configuration.stdout + configuration.stderr).toBe(0);
    expect(configuration.stdout).toEndWith(
        'Removed in this repository: The project keeps no Markdown files.  (undo: gspot add markdown)\n',
    );
});

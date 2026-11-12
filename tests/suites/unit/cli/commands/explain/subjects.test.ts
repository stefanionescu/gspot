import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { parseBashScript } from '#cli/parsers/code/bash.ts';
import {
    EXPLAIN_SETTINGS,
    PATH_IGNORES,
    SYNTAX_CHECK_TABLES,
    UNKNOWN_SUBJECT_CASES,
} from '#tests/config/commands/reports.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { pathOutputSchema } from '#tests/schemas/setup.ts';
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
    expect(explanation.unchecked).toBeNull();
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
    });
    const script = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(script.code, script.stdout + script.stderr).toBe(0);
    expect(pathOutputSchema.parse(JSON.parse(script.stdout))).toMatchObject({
        kind: 'path',
        subject: 'api/build.sh',
        path: 'api/build.sh',
        scope: 'api',
        fileKind: 'source',
        ignores: [...PATH_IGNORES],
    });
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

test('explain <check> lists the minimum versions of the tools that the check runs, not of every tool of its configuration', async () => {
    await using sandbox = await createGitSandbox({});
    const minimum = getTool(readConfigurations().values(), 'node').min_version;
    const result = await runGspot(sandbox.path, ['explain', 'javascript/eslint']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n').filter((line) => line.startsWith('Needs '))).toStrictEqual([
        `Needs node ${String(minimum)} or newer.`,
    ]);
});

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
    { subject: ['yaml/syntax', 'documents'], fields: { kind: 'lint-rule' } },
])('explain --json carries each command that its text prints: $subject', async ({ subject, fields }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash', 'yaml']) });
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

test('the undo command of an ignore, printed in a subfolder, removes the ignore from there', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], {
            tables: [
                '[[ignore]]',
                'check = "bash/shellcheck"',
                'paths = ["scripts/entry.sh"]',
                'reason = "The script splits words on purpose."',
                '',
            ].join('\n'),
        }),
        'scripts/entry.sh': CLEAN_BASH_SCRIPT,
    });
    const folder = join(sandbox.path, 'scripts');
    const explained = await runGspot(folder, ['explain', 'bash/shellcheck', '--json']);
    const { ignores } = JSON.parse(explained.stdout) as { ignores: Array<{ command: string }> };
    const command = ignores[0]?.command ?? '';
    expect(command).toBe('gspot unignore bash/shellcheck --paths entry.sh');
    const parsed = await parseBashScript(command);
    const removed = await runGspot(folder, parsed.commands[0]!.arguments as string[]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('[[ignore]]');
});

test.each([
    { commandArguments: ['explain', 'gspot/weakenings'] },
    { commandArguments: ['explain', 'gspot/weakenings', 'level'] },
])(
    '$commandArguments prints no path ignore, which cannot clear a finding on gspot.toml',
    async ({ commandArguments }) => {
        await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
        const result = await runGspot(sandbox.path, commandArguments);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).not.toContain('--paths');
        expect(result.stdout).toContain('gspot ignore gspot/weakenings --rule');
    },
);

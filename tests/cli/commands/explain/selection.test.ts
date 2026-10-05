// Bun command fixtures distinguish named explanations from tracked or explicit file paths.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { EXPLAIN_POLICY } from '#tests/config/cli/commands/explain.ts';
import { containingAll, textContaining } from '#tests/harness/expectations.ts';

test('explain > setting explanations include nested-only settings and each inherited value', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `configurations = []
[[scope]]
path = "api"
configurations = ["jest"]
[scope.tools.jest.coverage]
lines = 90
[[scope]]
path = "api/worker"
configurations = []
[scope.tools.jest.coverage]
lines = 95
`,
        'api/example.test.js': 'test("example", () => {});\n',
        'api/worker/example.test.js': 'test("worker", () => {});\n',
    });
    const result = await runGspot(sandbox.path, ['explain', 'tools.jest.coverage.lines', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        scopes: [
            { scope: 'api', current: 90, source: '[[scope]] api' },
            { scope: 'api/worker', current: 95, source: '[[scope]] api/worker' },
        ],
    });
    const policy = join(sandbox.path, 'gspot.toml');
    const original = await Bun.file(policy).text();
    await Bun.write(policy, original.replace('lines = 95', 'lines = 96'));
    const updated = await runGspot(sandbox.path, ['explain', 'tools.jest.coverage.lines', '--json']);
    expect(updated.code, updated.stdout + updated.stderr).toBe(0);
    expect(JSON.parse(updated.stdout)).toMatchObject({
        scopes: [
            { scope: 'api', current: 90 },
            { scope: 'api/worker', current: 96 },
        ],
    });
});
test('explain > path explanations include enabled repository commands and global exceptions', async () => {
    await using sandbox = await testdir();
    const policy = `configurations = []
[[scope]]
path = "api"
configurations = []
[[check]]
name = "project/syntax"
command = ["bash", "-n", "{files}"]
paths = ["**/*.sh"]
stage = "manual"
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': `${policy}\n[[ignore]]\ncheck = "project/syntax"\nreason = "The fixture verifies a disabled check."\n`,
        'api/build.sh': CLEAN_BASH_SCRIPT,
    });
    const ignored = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(ignored.code).toBe(0);
    expect(JSON.parse(ignored.stdout)).toMatchObject({
        checks: [],
        unchecked: 'no enabled check owns this file',
        ignores: [{ check: 'project/syntax', reason: 'The fixture verifies a disabled check.' }],
    });
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
    const corrected = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout)).toMatchObject({
        checks: [{ check: 'project/syntax', stage: 'manual' }],
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
});
test('explain > a recognized name keeps its meaning, and a tracked or explicit path selects a colliding file', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': EXPLAIN_POLICY,
        bash: CLEAN_BASH_SCRIPT,
        'api/build.sh': CLEAN_BASH_SCRIPT,
        'shellcheck/run.sh': CLEAN_BASH_SCRIPT,
    });
    commitAll(sandbox.path);
    const configuration = await runGspot(sandbox.path, ['explain', 'bash', '--json']);
    expect(configuration.code, configuration.stdout + configuration.stderr).toBe(0);
    expect(JSON.parse(configuration.stdout)).toMatchObject({ kind: 'configuration', subject: 'bash' });
    const file = await runGspot(sandbox.path, ['explain', './bash', '--json']);
    expect(file.code, file.stdout + file.stderr).toBe(0);
    expect(JSON.parse(file.stdout)).toMatchObject({ kind: 'path', subject: 'bash', path: 'bash' });
    // The shellcheck folder shares a check's tool name; the tracked path still selects the file.
    const tracked = await runGspot(sandbox.path, ['explain', 'shellcheck/run.sh', '--json']);
    expect(tracked.code, tracked.stdout + tracked.stderr).toBe(0);
    expect(JSON.parse(tracked.stdout)).toMatchObject({ kind: 'path', subject: 'shellcheck/run.sh' });
});

test('explain > a file path reports its scope, checks, and recorded ignores', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': EXPLAIN_POLICY,
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
        configurations: containingAll(['bash']),
        checks: containingAll([{ check: 'bash/shellcheck', stage: 'commit', configuration: 'bash' }]),
        ignores: [
            {
                check: 'bash/shellcheck',
                rule: 'SC2086',
                reason: 'The script deliberately splits a list of arguments.',
            },
        ],
    });
});

test('explain > a missing explicit path fails', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': EXPLAIN_POLICY, 'api/build.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const missing = await runGspot(sandbox.path, ['explain', './missing.sh', '--json']);
    expect(missing.code).toBe(2);
    expect(JSON.parse(missing.stdout)).toMatchObject({ error: 'selection', message: textContaining('missing.sh') });
});

test('an unknown explanation subject uses the command error contract', async () => {
    await using sandbox = await testdir();
    const result = await runGspot(sandbox.path, ['explain', 'unknown-configuration', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'selection',
        message: textContaining('There is no configuration called `unknown-configuration`.'),
    });
});

test('explain > configuration and check explanations still resolve without a policy', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    for (const [subject, kind] of [
        ['bash', 'configuration'],
        ['bash/shellcheck', 'check'],
    ] as const) {
        const result = await runGspot(sandbox.path, ['explain', subject, '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({ kind, subject });
    }
});

test.each([
    'level',
    'require_reasons',
    'tool_timeout_seconds',
    'run_with',
    'generated',
    'vendored',
    'exclude',
    'extra_checks',
    'tests',
])('explain recognizes the top-level setting %s', async (key) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'configurations = []\n' });
    const result = await runGspot(sandbox.path, ['explain', key, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ key });
});

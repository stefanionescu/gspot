import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import { script } from '#tests/harness/planted/cases.ts';
import { containingAll } from '#tests/harness/expectations.ts';

const EXPLAIN_POLICY = `kits = []

[[scope]]
path = "api"
kits = ["bash"]

[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/build.sh"]
reason = "The script deliberately splits a list of arguments."
`;

test('explain > setting explanations include nested-only settings and each inherited value', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `kits = []
[[scope]]
path = "api"
kits = ["jest"]
[scope.tools.jest.coverage]
lines = 90
[[scope]]
path = "api/worker"
kits = []
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
    expect(JSON.parse(updated.stdout)).toMatchObject({
        scopes: [
            { scope: 'api', current: 90 },
            { scope: 'api/worker', current: 96 },
        ],
    });
});
test('explain > path explanations include enabled repository commands and global exceptions', async () => {
    await using sandbox = await testdir();
    const policy = `kits = []
[[scope]]
path = "api"
kits = []
[[check]]
name = "project/syntax"
command = ["bash", "-n", "{files}"]
paths = ["**/*.sh"]
stage = "manual"
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': `${policy}\n[[ignore]]\ncheck = "project/syntax"\nreason = "The fixture verifies a disabled check."\n`,
        'api/build.sh': script,
    });
    const ignored = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(ignored.code).toBe(0);
    expect(JSON.parse(ignored.stdout)).toMatchObject({
        checks: [],
        unchecked: 'no enabled check owners this file',
        ignores: [{ check: 'project/syntax', reason: 'The fixture verifies a disabled check.' }],
    });
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
    const corrected = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
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
        bash: script,
        'api/build.sh': script,
        'shellcheck/run.sh': script,
    });
    commitAll(sandbox.path);
    const configuration = await runGspot(sandbox.path, ['explain', 'bash', '--json']);
    expect(configuration.code, configuration.stdout + configuration.stderr).toBe(0);
    expect(JSON.parse(configuration.stdout)).toMatchObject({ kind: 'kit', subject: 'bash' });
    const file = await runGspot(sandbox.path, ['explain', './bash', '--json']);
    expect(file.code, file.stdout + file.stderr).toBe(0);
    expect(JSON.parse(file.stdout)).toMatchObject({ kind: 'path', subject: 'bash', path: 'bash' });
    // The folder shares its name with bash/shellcheck, which once made the path read as one of its rules.
    const tracked = await runGspot(sandbox.path, ['explain', 'shellcheck/run.sh', '--json']);
    expect(JSON.parse(tracked.stdout)).toMatchObject({ kind: 'path', subject: 'shellcheck/run.sh' });
});

test('explain > a file path reports its scope, checks, and recorded ignores', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': EXPLAIN_POLICY,
        'api/build.sh': script,
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['explain', './api/build.sh', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        kind: 'path',
        subject: 'api/build.sh',
        path: 'api/build.sh',
        scope: 'api',
        file: 'source',
        kits: containingAll(['bash']),
        checks: containingAll([{ check: 'bash/shellcheck', stage: 'commit', kit: 'bash' }]),
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
    await createFileTree(sandbox.path, { 'gspot.toml': EXPLAIN_POLICY, 'api/build.sh': script });
    commitAll(sandbox.path);
    const missing = await runGspot(sandbox.path, ['explain', './missing.sh']);
    expect(missing.code).toBe(2);
});

test('explain > kit and check explanations still resolve without a policy', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    for (const [subject, kind] of [
        ['bash', 'kit'],
        ['bash/shellcheck', 'check'],
    ] as const) {
        const result = await runGspot(sandbox.path, ['explain', subject, '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({ kind, subject });
    }
});

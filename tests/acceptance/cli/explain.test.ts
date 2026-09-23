import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { commitAll, run, script } from '#tests/support/cli/planted.ts';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const POLICY = `version = 1
presets = []

[[scope]]
path = "api"
presets = ["bash"]

[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["api/build.sh"]
reason = "The script deliberately splits a list of arguments."
`;

describe('explain', () => {
    test('setting explanations include nested-only settings and each inherited value', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1
presets = []
[[scope]]
path = "api"
presets = ["jest"]
[scope.tools.jest]
coverage_lines = 90
[[scope]]
path = "api/worker"
presets = []
[scope.tools.jest]
coverage_lines = 95
`,
            'api/example.test.js': 'test("example", () => {});\n',
            'api/worker/example.test.js': 'test("worker", () => {});\n',
        });
        const result = await run(sandbox.path, ['explain', 'tools.jest.coverage_lines', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({
            scopes: [
                { scope: 'api', current: 90, source: '[[scope]] api' },
                { scope: 'api/worker', current: 95, source: '[[scope]] api/worker' },
            ],
        });
        const text = await run(sandbox.path, ['explain', 'tools.jest.coverage_lines']);
        expect(text.stdout).toContain('Scope: api\n');
        expect(text.stdout).toContain('Scope: api/worker\n');
        expect(text.stdout).toContain('Current value: 95');
        expect(text.stdout).toContain('gspot set tools.jest.coverage_lines <value> --scope api/worker --reason');
        const changed = await run(sandbox.path, ['set', 'tools.jest.coverage_lines', '96', '--scope', 'api/worker']);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        const updated = await run(sandbox.path, ['explain', 'tools.jest.coverage_lines', '--json']);
        expect(JSON.parse(updated.stdout)).toMatchObject({
            scopes: [
                { scope: 'api', current: 90 },
                { scope: 'api/worker', current: 96 },
            ],
        });
    });
    test('path explanations include enabled repository commands and global exceptions', async () => {
        await using sandbox = await testdir();
        const policy = `version = 1
presets = []
[[scope]]
path = "api"
presets = []
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
        const ignored = await run(sandbox.path, ['explain', './api/build.sh', '--json']);
        expect(ignored.code).toBe(0);
        expect(JSON.parse(ignored.stdout)).toMatchObject({
            checks: [],
            unchecked: 'no enabled check claims this file',
            ignores: [{ check: 'project/syntax', reason: 'The fixture verifies a disabled check.' }],
        });
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
        const corrected = await run(sandbox.path, ['explain', './api/build.sh', '--json']);
        expect(JSON.parse(corrected.stdout)).toMatchObject({
            checks: [{ check: 'project/syntax', stage: 'manual' }],
            ignores: [],
        });
        expect(JSON.parse(corrected.stdout)).not.toHaveProperty('unchecked');
        const command = await run(sandbox.path, ['explain', 'project/syntax', '--json']);
        expect(command.code, command.stdout + command.stderr).toBe(0);
        expect(JSON.parse(command.stdout)).toMatchObject({
            kind: 'check',
            check: 'project/syntax',
            stage: 'manual',
            command: ['bash', '-n', '{files}'],
            paths: ['**/*.sh'],
        });
        const commandText = await run(sandbox.path, ['explain', 'project/syntax']);
        expect(commandText.stdout).toContain('repository command');
        expect(commandText.stdout).toContain('gspot ignore project/syntax');
    });
    test('a recognized name keeps its meaning and an explicit path selects a colliding file', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': POLICY, bash: script, 'api/build.sh': script });
        commitAll(sandbox.path);
        const preset = await run(sandbox.path, ['explain', 'bash', '--json']);
        expect(preset.code, preset.stdout + preset.stderr).toBe(0);
        expect(JSON.parse(preset.stdout)).toMatchObject({ kind: 'preset', subject: 'bash' });
        const file = await run(sandbox.path, ['explain', './bash', '--json']);
        expect(file.code, file.stdout + file.stderr).toBe(0);
        expect(JSON.parse(file.stdout)).toMatchObject({ kind: 'path', subject: 'bash', path: 'bash' });
    });

    test('a file path reports its scope, checks, and recorded ignores', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': POLICY,
            'api/build.sh': script,
        });
        commitAll(sandbox.path);
        const result = await run(sandbox.path, ['explain', './api/build.sh', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({
            kind: 'path',
            subject: 'api/build.sh',
            path: 'api/build.sh',
            scope: 'api',
            nature: 'source',
            presets: expect.arrayContaining(['bash']),
            checks: expect.arrayContaining([{ check: 'bash/shellcheck', stage: 'commit', preset: 'bash' }]),
            ignores: [
                {
                    check: 'bash/shellcheck',
                    rule: 'SC2086',
                    reason: 'The script deliberately splits a list of arguments.',
                },
            ],
        });
        const text = await run(sandbox.path, ['explain', 'api/build.sh']);
        expect(text.code, text.stdout + text.stderr).toBe(0);
        expect(text.stdout).toContain('api/build.sh  (scope api, source');
        expect(text.stdout).toContain('bash/shellcheck  commit');
        expect(text.stdout).toContain('SC2086');
    });

    test('a missing explicit path fails', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': POLICY, 'api/build.sh': script });
        commitAll(sandbox.path);
        const missing = await run(sandbox.path, ['explain', './missing.sh']);
        expect(missing.code).toBe(2);
        expect(missing.stdout + missing.stderr).toContain('missing.sh is not a file git tracks or would track here');
    });

    test('preset and check explanations still resolve without a policy', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': '# Example\n' });
        commitAll(sandbox.path);
        for (const [subject, kind] of [
            ['bash', 'preset'],
            ['bash/shellcheck', 'check'],
        ] as const) {
            const result = await run(sandbox.path, ['explain', subject, '--json']);
            expect(result.code, result.stdout + result.stderr).toBe(0);
            expect(JSON.parse(result.stdout)).toMatchObject({ kind, subject });
        }
    });
});

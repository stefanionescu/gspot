import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { commitAll, run, script } from '#tests/harness/planted.ts';

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
    test('a recognized name keeps its meaning and an explicit path selects a colliding file', async () => {
        await using fixture = await createFixture({ 'gspot.toml': POLICY, bash: script, 'api/build.sh': script });
        commitAll(fixture.path);
        const preset = await run(fixture.path, ['explain', 'bash', '--json']);
        expect(preset.code, preset.stdout + preset.stderr).toBe(0);
        expect(JSON.parse(preset.stdout)).toMatchObject({ kind: 'preset', subject: 'bash' });
        const file = await run(fixture.path, ['explain', './bash', '--json']);
        expect(file.code, file.stdout + file.stderr).toBe(0);
        expect(JSON.parse(file.stdout)).toMatchObject({ kind: 'path', subject: 'bash', path: 'bash' });
    });

    test('a file path reports its scope, checks, and recorded ignores', async () => {
        await using fixture = await createFixture({
            'gspot.toml': POLICY,
            'api/build.sh': script,
        });
        commitAll(fixture.path);
        const result = await run(fixture.path, ['explain', './api/build.sh', '--json']);
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
        const text = await run(fixture.path, ['explain', 'api/build.sh']);
        expect(text.code, text.stdout + text.stderr).toBe(0);
        expect(text.stdout).toContain('api/build.sh  (scope api, source');
        expect(text.stdout).toContain('bash/shellcheck  commit');
        expect(text.stdout).toContain('SC2086');
    });

    test('a missing explicit path fails and the removed command is unknown', async () => {
        await using fixture = await createFixture({ 'gspot.toml': POLICY, 'api/build.sh': script });
        commitAll(fixture.path);
        const missing = await run(fixture.path, ['explain', './missing.sh']);
        expect(missing.code).toBe(2);
        expect(missing.stdout + missing.stderr).toContain('missing.sh is not a file git tracks or would track here');
        const removed = await run(fixture.path, ['why', 'missing.sh']);
        expect(removed.code).toBe(2);
        expect(removed.stderr).toContain("unknown command 'why'");
    });

    test('preset and check explanations still resolve without a policy', async () => {
        await using fixture = await createFixture({ 'README.md': '# Example\n' });
        commitAll(fixture.path);
        for (const [subject, kind] of [
            ['bash', 'preset'],
            ['bash/shellcheck', 'check'],
        ] as const) {
            const result = await run(fixture.path, ['explain', subject, '--json']);
            expect(result.code, result.stdout + result.stderr).toBe(0);
            expect(JSON.parse(result.stdout)).toMatchObject({ kind, subject });
        }
    });
});

// Planted repositories: what init refuses before it writes, and that every hook runs under the Bash macOS ships.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { hookBody } from '#cli/emit/hooks.ts';
import { chmodSync, existsSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { commitAll, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

const SYSTEM_BASH = '/bin/bash';
const QUIET = ['--runner', 'none', '--ci', 'none', '--no-rules', '--no-install'];

describe('init refusals', () => {
    test(
        'a choice flag outside its list exits 2 and names the allowed values',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script });
            commitAll(fixture.path);
            const result = run(fixture.path, ['init', '--yes', '--hooks', 'foo']);
            expect(result.code).toBe(2);
            expect(result.stderr).toContain('Allowed choices are gspot, lefthook, husky, none');
            expect(existsSync(join(fixture.path, 'gspot.toml'))).toBe(false);
            expect(run(fixture.path, ['check', '--at', 'later']).code).toBe(2);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'an unknown preset names the near match, and a required preset cannot be left out',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script });
            commitAll(fixture.path);
            const unknown = run(fixture.path, ['init', '--yes', '--presets', 'bassh', ...QUIET]);
            expect(unknown.code).toBe(2);
            expect(unknown.stderr).toContain('Did you mean `bash`');
            const required = run(fixture.path, ['init', '--yes', '--presets', 'bash', '--without', 'naming', ...QUIET]);
            expect(required.code).toBe(2);
            expect(required.stderr).toContain('bash requires naming');
            expect(existsSync(join(fixture.path, 'gspot.toml'))).toBe(false);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'uncommitted changes stop init until --allow-dirty is given',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script });
            commitAll(fixture.path);
            await Bun.write(join(fixture.path, 'notes.txt'), 'draft\n');
            const refused = run(fixture.path, ['init', '--yes', '--presets', 'bash', ...QUIET]);
            expect(refused.code).toBe(2);
            expect(refused.stderr).toContain('--allow-dirty');
            expect(existsSync(join(fixture.path, 'gspot.toml'))).toBe(false);
            const allowed = run(fixture.path, ['init', '--yes', '--presets', 'bash', '--allow-dirty', ...QUIET], {
                PATH: toolsPath(['ast-grep']),
            });
            expect(allowed.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );

    test.skipIf(!existsSync(SYSTEM_BASH))('every hook body runs under the system Bash', async () => {
        await using fixture = await createFixture({});
        for (const name of ['pre-commit', 'pre-push', 'commit-msg'] as const) {
            const path = join(fixture.path, name);
            await Bun.write(path, hookBody(name, 'none', '/bin/echo'));
            chmodSync(path, 0o755);
            const result = Bun.spawnSync([SYSTEM_BASH, path, 'message-file'], {
                env: { PATH: '/usr/bin:/bin', GSPOT_BIN: '' },
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(result.stderr.toString()).toBe('');
            expect(result.exitCode).toBe(0);
            expect(result.stdout.toString()).toContain('check');
        }
    });
});

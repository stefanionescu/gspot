// Planted repositories: gspot init --yes then gspot check on each; asserts exit codes, check lines and finding counts.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import { commitAll, PLANTED_TIMEOUT_MS, run, script } from '#tests/harness/planted.ts';

describe('the bash planted repository', () => {
    test(
        'init --yes writes the policy and check passes over a clean script',
        async () => {
            await using fixture = await createFixture({ 'scripts/build.sh': script, 'README.md': '# planted\n' });
            commitAll(fixture.path);
            const init = await run(fixture.path, [
                'init',
                '--yes',
                '--presets',
                'bash',
                '--runner',
                'none',
                '--ci',
                'none',
                '--no-rules',
                '--no-install',
                '--hooks',
                'gspot',
            ]);
            expect(init.stdout).toContain('write');
            expect(existsSync(join(fixture.path, 'gspot.toml'))).toBe(true);
            expect(existsSync(join(fixture.path, '.gspot', 'version'))).toBe(true);
            expect(existsSync(join(fixture.path, '.gspot', 'hooks', 'pre-commit'))).toBe(true);
            expect(readFileSync(join(fixture.path, '.gitignore'), 'utf8')).toContain('>>> gspot managed >>>');
            const check = await run(fixture.path, ['check', 'bash/shellcheck']);
            expect(check.code).toBe(0);
            expect(check.stdout).toContain('bash/shellcheck');
            expect(check.stdout).toContain('ok');
            const json = await run(fixture.path, ['check', 'bash/shfmt', '--json']);
            const record = JSON.parse(json.stdout) as { checks: { check: string; status: string }[]; exitCode: number };
            expect(record.checks[0]?.check).toBe('bash/shfmt');
            expect(record.exitCode).toBe(0);
            const drift = await run(fixture.path, ['apply', '--check']);
            expect(drift.code).toBe(0);
            const second = await run(fixture.path, ['init', '--yes']);
            expect(second.code).toBe(2);
            expect(second.stdout).toContain('gspot doctor');
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'a finding fails the check with the file, the rule and a help line',
        async () => {
            await using fixture = await createFixture({ 'scripts/good.sh': script, 'README.md': '# planted\n' });
            commitAll(fixture.path);
            await run(fixture.path, [
                'init',
                '--yes',
                '--presets',
                'bash',
                '--runner',
                'none',
                '--ci',
                'none',
                '--no-rules',
                '--no-install',
            ]);
            await Bun.write(join(fixture.path, 'scripts', 'bad.sh'), '#!/usr/bin/env bash\necho $1\n');
            const check = await run(fixture.path, ['check', 'bash/shellcheck', '--no-cache']);
            expect(check.code).toBe(1);
            expect(check.stdout).toContain('scripts/bad.sh:2:6  SC2086');
            expect(check.stdout).toContain('help:');
            expect(check.stdout).toContain('reproduce: gspot check bash/shellcheck');
            const ignored = await run(fixture.path, [
                'ignore',
                'bash/shellcheck',
                '--rule',
                'SC2086',
                '--reason',
                'Word splitting is wanted in this launcher.',
            ]);
            expect(ignored.code).toBe(0);
            const ignoredCheck = await run(fixture.path, ['check', 'bash/shellcheck', '--no-cache']);
            expect(ignoredCheck.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'a missing tool fails with the install hint',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script, home: {}, bin: {} });
            commitAll(fixture.path);
            await run(fixture.path, [
                'init',
                '--yes',
                '--presets',
                'bash',
                '--runner',
                'none',
                '--ci',
                'none',
                '--no-rules',
                '--no-install',
            ]);
            const bin = join(fixture.path, 'bin');
            const gitPath = Bun.which('git');
            expect(gitPath).not.toBeNull();
            symlinkSync(process.execPath, join(bin, process.platform === 'win32' ? 'bun.exe' : 'bun'));
            symlinkSync(gitPath!, join(bin, process.platform === 'win32' ? 'git.exe' : 'git'));
            const check = await run(fixture.path, ['check', 'bash/shellcheck', '--no-cache'], {
                PATH: bin,
                HOME: join(fixture.path, 'home'),
                MISE_DATA_DIR: join(fixture.path, 'home', 'mise'),
            });
            expect(check.code).toBe(1);
            expect(check.stdout).toContain('missing');
            expect(check.stdout).toContain('shellcheck 0.11.0 is not installed');
            for (const name of ['shell-branches', 'shell-nesting', 'shell-mutable-assignments']) {
                const missing = await run(fixture.path, ['check', `structure/${name}`, '--no-cache'], {
                    PATH: bin,
                    HOME: join(fixture.path, 'home'),
                    MISE_DATA_DIR: join(fixture.path, 'home', 'mise'),
                });
                expect(missing.code).toBe(1);
                expect(missing.stdout).toContain('missing');
                expect(missing.stdout).toContain('mise install ast-grep');
            }
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'a version pin from another gspot refuses check with both remedies',
        async () => {
            await using fixture = await createFixture({ 'scripts/a.sh': script });
            commitAll(fixture.path);
            await run(fixture.path, [
                'init',
                '--yes',
                '--presets',
                'bash',
                '--runner',
                'none',
                '--ci',
                'none',
                '--no-rules',
                '--no-install',
            ]);
            await Bun.write(join(fixture.path, '.gspot', 'version'), '9.9.9\n');
            const check = await run(fixture.path, ['check']);
            expect(check.code).toBe(2);
            expect(check.stderr).toContain('mise install');
            expect(check.stderr).toContain('gspot upgrade --to');
            const doctor = await run(fixture.path, ['doctor']);
            expect(doctor.code).not.toBe(2);
        },
        PLANTED_TIMEOUT_MS,
    );
});

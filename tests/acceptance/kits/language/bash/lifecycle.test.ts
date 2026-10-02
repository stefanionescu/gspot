// Planted repositories: gspot init --yes then gspot check on each; asserts exit codes, check lines, and finding counts.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { readGitSetting } from '#cli/platform/git.ts';
import { script } from '#tests/harness/planted/cases.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { existsSync, symlinkSync, readFileSync } from 'node:fs';
import type { RunReport } from '#cli/types/execution/execution.ts';

test(
    'init --yes writes the policy and check passes over a clean script',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/build.sh': script, 'README.md': '# planted\n' });
        commitAll(sandbox.path);
        const init = await spawnGspot(sandbox.path, [
            'init',
            '--yes',
            '--kits',
            'bash',
            '--no-runner',
            '--no-ci',
            '--no-guides',
            '--no-install',
        ]);
        expect(init.code, init.stdout + init.stderr).toBe(0);
        expect(init.stdout).toContain('write');
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
        expect(existsSync(join(sandbox.path, '.gspot', 'version'))).toBe(true);
        expect(existsSync(join(sandbox.path, '.gspot', 'hooks', 'pre-commit'))).toBe(true);
        expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
        expect(readFileSync(join(sandbox.path, '.gitignore'), 'utf8')).toContain('>>> gspot managed >>>');
        const check = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']);
        expect(check.code).toBe(0);
        expect((JSON.parse(check.stdout) as RunReport).checks).toStrictEqual([
            containing({ check: 'bash/shellcheck', status: 'ok' }),
        ]);
        const selected = await spawnGspot(sandbox.path, ['set', 'extra_checks', 'bash/shfmt']);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const json = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shfmt', '--json']);
        const record = JSON.parse(json.stdout) as { checks: { check: string; status: string }[]; exitCode: number };
        expect(json.code, json.stdout + json.stderr).toBe(0);
        expect(record.checks).toMatchObject([{ check: 'bash/shfmt', status: 'ok' }]);
        expect(record.exitCode).toBe(0);
        const drift = await spawnGspot(sandbox.path, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(drift.stdout) as { drift: unknown[] }).drift).toStrictEqual([]);
        expect(drift.code).toBe(0);
        const second = await spawnGspot(sandbox.path, ['init', '--yes']);
        expect(second.code).toBe(2);
        expect(second.stdout).toContain('gspot doctor');
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'a missing tool fails with the install hint',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'scripts/a.sh': script,
            '.gitignore': 'home/\nbin/\n',
            home: {},
            bin: {},
        });
        commitAll(sandbox.path);
        const bin = join(sandbox.path, 'bin');
        const gitPath = Bun.which('git');
        expect(gitPath).not.toBeNull();
        symlinkSync(process.execPath, join(bin, process.platform === 'win32' ? 'bun.exe' : 'bun'));
        symlinkSync(gitPath!, join(bin, process.platform === 'win32' ? 'git.exe' : 'git'));
        const environment = {
            PATH: bin,
            HOME: join(sandbox.path, 'home'),
            MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
        };
        const initialized = await spawnGspot(
            sandbox.path,
            ['init', '--yes', '--kits', 'bash', '--no-runner', '--no-ci', '--no-guides', '--no-install'],
            environment,
        );
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(initialized.stdout + initialized.stderr).toContain('run gspot check');
        const check = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck'], {
            PATH: bin,
            HOME: join(sandbox.path, 'home'),
            MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
        });
        expect(check.code).toBe(2);
        expect(check.stdout).toContain('missing');
        expect(check.stdout).toContain('shellcheck 0.11.0 is not installed');
        const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const missing = await spawnGspot(sandbox.path, ['check', '--only', 'structure/bash-limits'], {
            PATH: bin,
            HOME: join(sandbox.path, 'home'),
            MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
        });
        expect(missing.code).toBe(2);
        expect(missing.stdout).toContain('missing');
        expect(missing.stdout).toContain('Run: gspot install');
        const available = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']);
        expect(available.code, available.stdout + available.stderr).toBe(0);
        expect((JSON.parse(available.stdout) as RunReport).checks).toMatchObject([
            { check: 'bash/shellcheck', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'a version pin from another gspot refuses check with both remedies',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/a.sh': script });
        commitAll(sandbox.path);
        await spawnGspot(sandbox.path, [
            'init',
            '--yes',
            '--kits',
            'bash',
            '--no-runner',
            '--no-ci',
            '--no-guides',
            '--no-install',
        ]);
        const originalVersion = readFileSync(join(sandbox.path, '.gspot', 'version'));
        await Bun.write(join(sandbox.path, '.gspot', 'version'), '9.9.9\n');
        const check = await spawnGspot(sandbox.path, ['check']);
        expect(check.code).toBe(2);
        expect(check.stderr).toContain('mise install');
        expect(check.stderr).toContain('gspot apply');
        const doctor = await spawnGspot(sandbox.path, ['doctor']);
        expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
        await Bun.write(join(sandbox.path, '.gspot', 'version'), originalVersion);
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'bash/shellcheck', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);

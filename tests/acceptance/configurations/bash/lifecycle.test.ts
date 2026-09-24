// Planted repositories: gspot init --yes then gspot check on each; asserts exit codes, check lines and finding counts.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { script } from '#tests/support/cli/planted.ts';
import { expect, test } from 'bun:test';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test(
    'init --yes writes the policy and check passes over a clean script',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/build.sh': script, 'README.md': '# planted\n' });
        commitAll(sandbox.path);
        const init = await run(sandbox.path, [
            'init',
            '--yes',
            '--configurations',
            'bash',
            '--no-runner',
            '--no-ci',
            '--no-rules',
            '--no-install',
            '--hooks',
            'gspot',
        ]);
        expect(init.stdout).toContain('write');
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
        expect(existsSync(join(sandbox.path, '.gspot', 'version'))).toBe(true);
        expect(existsSync(join(sandbox.path, '.gspot', 'hooks', 'pre-commit'))).toBe(false);
        expect(readFileSync(join(sandbox.path, '.gitignore'), 'utf8')).toContain('>>> gspot managed >>>');
        const check = await run(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']);
        expect(check.code).toBe(0);
        expect(JSON.parse(check.stdout).checks).toEqual([
            expect.objectContaining({ check: 'bash/shellcheck', status: 'ok' }),
        ]);
        const selected = await run(sandbox.path, ['set', 'extra_checks', 'bash/shfmt']);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const json = await run(sandbox.path, ['check', '--only', 'bash/shfmt', '--json']);
        const record = JSON.parse(json.stdout) as { checks: { check: string; status: string }[]; exitCode: number };
        expect(record.checks[0]?.check).toBe('bash/shfmt');
        expect(record.exitCode).toBe(0);
        const drift = await run(sandbox.path, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(drift.stdout) as { drift: unknown[] }).drift).toEqual([]);
        expect(drift.code).toBe(0);
        const second = await run(sandbox.path, ['init', '--yes']);
        expect(second.code).toBe(2);
        expect(second.stdout).toContain('gspot doctor');
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'a finding fails the check with the file, the rule and a help line',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/good.sh': script, 'README.md': '# planted\n' });
        commitAll(sandbox.path);
        await run(sandbox.path, [
            'init',
            '--yes',
            '--configurations',
            'bash',
            '--no-runner',
            '--no-ci',
            '--no-rules',
            '--no-install',
        ]);
        await Bun.write(join(sandbox.path, 'scripts', 'bad.sh'), '#!/usr/bin/env bash\necho $1\n');
        const check = await run(sandbox.path, ['check', '--only', 'bash/shellcheck', '--no-cache']);
        expect(check.code).toBe(1);
        expect(check.stdout).toContain('scripts/bad.sh:2:6  SC2086');
        expect(check.stdout).toContain('help:');
        expect(check.stdout).toContain('reproduce: gspot check --only bash/shellcheck');
        const ignored = await run(sandbox.path, [
            'ignore',
            'bash/shellcheck',
            '--rule',
            'SC2086',
            '--reason',
            'Word splitting is wanted in this launcher.',
        ]);
        expect(ignored.code).toBe(0);
        const ignoredCheck = await run(sandbox.path, ['check', '--only', 'bash/shellcheck', '--no-cache']);
        expect(ignoredCheck.code).toBe(0);
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
        const initialized = await run(
            sandbox.path,
            ['init', '--yes', '--configurations', 'bash', '--no-runner', '--no-ci', '--no-rules', '--no-install'],
            environment,
        );
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(initialized.stdout + initialized.stderr).toContain('run gspot check');
        const check = await run(sandbox.path, ['check', '--only', 'bash/shellcheck', '--no-cache'], {
            PATH: bin,
            HOME: join(sandbox.path, 'home'),
            MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
        });
        expect(check.code).toBe(2);
        expect(check.stdout).toContain('missing');
        expect(check.stdout).toContain('shellcheck 0.11.0 is not installed');
        const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        for (const name of ['bash-branches', 'bash-nesting', 'bash-mutable-assignments']) {
            const missing = await run(sandbox.path, ['check', '--only', `structure/${name}`, '--no-cache'], {
                PATH: bin,
                HOME: join(sandbox.path, 'home'),
                MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
            });
            expect(missing.code).toBe(2);
            expect(missing.stdout).toContain('missing');
            expect(missing.stdout).toContain('Run: gspot install');
        }
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'a version pin from another gspot refuses check with both remedies',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/a.sh': script });
        commitAll(sandbox.path);
        await run(sandbox.path, [
            'init',
            '--yes',
            '--configurations',
            'bash',
            '--no-runner',
            '--no-ci',
            '--no-rules',
            '--no-install',
        ]);
        await Bun.write(join(sandbox.path, '.gspot', 'version'), '9.9.9\n');
        const check = await run(sandbox.path, ['check']);
        expect(check.code).toBe(2);
        expect(check.stderr).toContain('mise install');
        expect(check.stderr).toContain('gspot apply');
        const doctor = await run(sandbox.path, ['doctor']);
        expect(doctor.code).not.toBe(2);
    },
    PLANTED_TIMEOUT_MS,
);

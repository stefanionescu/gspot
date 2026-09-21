// Planted repositories: gspot init --yes then gspot check on each; asserts exit codes, check lines and finding counts.
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import { commitAll, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

describe('the bash planted repository', () => {
    test(
        'syntax checks use each file dialect and reject its broken syntax',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'gspot.toml': 'version = 1\nlevel = "all"\npresets = ["bash"]\n',
                'script.sh': 'echo example\n',
                launcher: '#!/usr/bin/env -S bash -e\necho example\n',
                'script.zsh': 'repeat 2 do print example; done\n',
                zlauncher: '#!/usr/bin/env -S zsh -f\nrepeat 2 do print example; done\n',
                'script.bats': '@test "example" {\n    true\n}\n',
            });
            const environment = { PATH: toolsPath(['bats']) };
            const applied = await run(sandbox.path, ['apply'], environment);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const cases = [
                { check: 'bash/syntax', path: 'script.sh', files: 2, broken: 'if then\n' },
                { check: 'bash/zsh-syntax', path: 'script.zsh', files: 2, broken: 'if then\n' },
                {
                    check: 'bash/bats-syntax',
                    path: 'script.bats',
                    files: 1,
                    broken: '@test "broken" {\n    if then\n}\n',
                },
            ];
            for (const entry of cases) {
                const clean = await run(
                    sandbox.path,
                    ['check', '--only', entry.check, '--no-cache', '--json'],
                    environment,
                );
                expect(clean.code, clean.stdout + clean.stderr).toBe(0);
                const report = JSON.parse(clean.stdout) as { checks: { files: number; status: string }[] };
                expect(report.checks[0]?.status).toBe('ok');
                expect(report.checks[0]?.files).toBe(entry.files);
                const path = join(sandbox.path, entry.path);
                const original = readFileSync(path);
                try {
                    await Bun.write(path, entry.broken);
                    const broken = await run(sandbox.path, ['check', '--only', entry.check, '--no-cache'], environment);
                    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
                    expect(broken.stdout).toContain(entry.path);
                    expect(broken.stdout).toContain('syntax');
                } finally {
                    await Bun.write(path, original);
                }
            }
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'init --yes writes the policy and check passes over a clean script',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/build.sh': script, 'README.md': '# planted\n' });
            commitAll(sandbox.path);
            const init = await run(sandbox.path, [
                'init',
                '--yes',
                '--presets',
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
            expect(existsSync(join(sandbox.path, '.gspot', 'hooks', 'pre-commit'))).toBe(true);
            expect(readFileSync(join(sandbox.path, '.gitignore'), 'utf8')).toContain('>>> gspot managed >>>');
            const check = await run(sandbox.path, ['check', '--only', 'bash/shellcheck']);
            expect(check.code).toBe(0);
            expect(check.stdout).toContain('bash/shellcheck');
            expect(check.stdout).toContain('ok');
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
                '--presets',
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
                ['init', '--yes', '--presets', 'bash', '--no-runner', '--no-ci', '--no-rules', '--no-install'],
                environment,
            );
            expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
            expect(initialized.stdout + initialized.stderr).toContain('run gspot check');
            const check = await run(sandbox.path, ['check', '--only', 'bash/shellcheck', '--no-cache'], {
                PATH: bin,
                HOME: join(sandbox.path, 'home'),
                MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
            });
            expect(check.code).toBe(1);
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
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            commitAll(sandbox.path);
            await run(sandbox.path, [
                'init',
                '--yes',
                '--presets',
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
            expect(check.stderr).toContain('gspot upgrade --to');
            const doctor = await run(sandbox.path, ['doctor']);
            expect(doctor.code).not.toBe(2);
        },
        PLANTED_TIMEOUT_MS,
    );
});

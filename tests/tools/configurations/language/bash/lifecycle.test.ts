// Test repositories: gspot init --yes then gspot check on each; asserts exit codes, check lines, and finding counts.
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { readGitSetting } from '#cli/platform/git.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { existsSync, symlinkSync, readFileSync } from 'node:fs';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import { buildToolsPath, installToolProjects } from '#tests/harness/install.ts';

test(
    'init --yes writes the policy and check passes over a clean script',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'scripts/build.sh': CLEAN_BASH_SCRIPT, 'README.md': '# test\n' });
        commitAll(sandbox.path);
        const environment = { PATH: buildToolsPath(['shellcheck', 'shfmt']) };
        const init = await spawnGspot(
            sandbox.path,
            ['init', '--yes', '--configurations', 'bash', '--no-task', '--no-ci', '--no-rules', '--no-install'],
            environment,
        );
        expect(init.code, init.stdout + init.stderr).toBe(0);
        expect(init.stdout).toContain('write');
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(true);
        expect(existsSync(join(sandbox.path, '.gspot', 'version'))).toBe(true);
        expect(existsSync(join(sandbox.path, '.gspot', 'hooks', 'pre-commit'))).toBe(true);
        expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBeUndefined();
        expect(readFileSync(join(sandbox.path, '.gitignore'), 'utf8')).toContain('>>> gspot managed >>>');
        const check = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json'], environment);
        expect(check.code).toBe(0);
        expect((JSON.parse(check.stdout) as RunReport).checks).toStrictEqual([
            containing({ check: 'bash/shellcheck', status: 'passed' }),
        ]);
        const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const json = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shfmt', '--json'], environment);
        const record = JSON.parse(json.stdout) as RunReport;
        expect(json.code, json.stdout + json.stderr).toBe(0);
        expect(record.checks).toMatchObject([{ check: 'bash/shfmt', status: 'passed' }]);
        const reconciled = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(reconciled.code, reconciled.stdout + reconciled.stderr).toBe(0);
        await installToolProjects(sandbox.path);
        const drift = await spawnGspot(sandbox.path, ['apply', '--dry-run', '--json'], environment);
        expect((JSON.parse(drift.stdout) as ApplyPreviewJson).drift).toStrictEqual([]);
        expect(drift.code).toBe(0);
        const second = await spawnGspot(sandbox.path, ['init', '--yes'], environment);
        expect(second.code).toBe(2);
        expect(second.stdout).toContain('gspot doctor');
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test(
    'a missing tool fails with the install hint',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'scripts/a.sh': CLEAN_BASH_SCRIPT,
            '.gitignore': 'home/\nbin/\n',
            home: {},
            bin: {},
        });
        commitAll(sandbox.path);
        const bin = join(sandbox.path, 'bin');
        const gitPath = Bun.which('git');
        expect(gitPath).not.toBeNull();
        symlinkSync(process.execPath, join(bin, process.platform === 'win32' ? 'bun.exe' : 'bun'));
        // Git for Windows finds its installation from the folder git.exe sits in, which holds no lint tool.
        if (process.platform !== 'win32') symlinkSync(gitPath!, join(bin, 'git'));
        const path = process.platform === 'win32' ? `${bin}${delimiter}${dirname(gitPath!)}` : bin;
        const environment = {
            PATH: path,
            HOME: join(sandbox.path, 'home'),
            MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
        };
        const initialized = await spawnGspot(
            sandbox.path,
            ['init', '--yes', '--configurations', 'bash', '--no-task', '--no-ci', '--no-rules', '--no-install'],
            { ...environment, PATH: buildToolsPath([]) },
        );
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(initialized.stdout + initialized.stderr).toContain('run gspot check');
        const check = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck'], environment);
        expect(check.code).toBe(2);
        expect(check.stdout).toContain('missing');
        expect(check.stdout).toContain('shellcheck 0.11.0 is not installed');
        const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const missing = await spawnGspot(sandbox.path, ['check', '--only', 'bash/limits'], environment);
        expect(missing.code).toBe(2);
        expect(missing.stdout).toContain('missing');
        expect(missing.stdout).toContain('Run: gspot install');
        const available = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']);
        expect(available.code, available.stdout + available.stderr).toBe(0);
        expect((JSON.parse(available.stdout) as RunReport).checks).toMatchObject([
            { check: 'bash/shellcheck', status: 'passed', findings: [] },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

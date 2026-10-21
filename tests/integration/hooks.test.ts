import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { readGitSetting } from '#cli/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { installRuntimes } from '#tests/setup/install.ts';
import { HOOKS_SETTINGS } from '#tests/data/test-setup.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import { INDEX_COMMAND, SAMPLE_COMMAND } from '#tests/data/hooks.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';
import { runGit, commitAll, readGitOutput } from '#tests/setup/git.ts';
import { runGspot, spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/settings.ts';

// A fresh clone installs the locked tools, then rejects and accepts a real staged commit.
async function assertCloneHooks(source: string, environment: Record<string, string>): Promise<void> {
    await using cloneRoot = await testdir();
    const clone = join(cloneRoot.path, 'clone');
    const cloned = runGit(source, ['clone', '--quiet', '--no-local', source, clone]);
    expect(cloned.code, cloned.stdout + cloned.stderr).toBe(0);
    await installRuntimes(clone);
    const uninstalled = parseCheckReport(await runGspot(clone, ['check', '--only', 'bash/shellcheck', '--json']));
    expect(uninstalled.code, uninstalled.stdout + uninstalled.stderr).toBe(0);
    expect(uninstalled.report).toMatchObject({
        stage: 'all',
        checks: [{ check: 'bash/shellcheck', scope: '', status: 'passed', fileCount: 2, findings: [] }],
        exitCode: 0,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
        const installation = await spawnGspot(clone, ['install']);
        expect(installation.code, installation.stdout + installation.stderr).toBe(0);
        const status = runGit(clone, ['status', '--porcelain']);
        expect(status.code, status.stderr).toBe(0);
        expect(status.stdout).toBe('');
    }
    const ready = await spawnGspot(clone, ['check', '--only', 'bash/shellcheck']);
    expect(ready.code, ready.stdout + ready.stderr).toBe(0);
    await writeFile(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho $1\n');
    expect(runGit(clone, ['add', 'scripts/b.sh']).code).toBe(0);
    const rejected = runGit(clone, ['commit', '-qm', 'Unquoted shell input'], environment);
    expect(rejected.code).not.toBe(0);
    expect(rejected.stdout + rejected.stderr).toContain('SC2086');
    await writeFile(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "${1:-ready}"\n');
    expect(runGit(clone, ['add', 'scripts/b.sh']).code).toBe(0);
    const accepted = runGit(clone, ['commit', '-qm', 'Quote shell input'], environment);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
}

test('installed and freshly cloned repositories enforce staged findings through real commits', async () => {
    await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });

    await installRuntimes(sandbox.path);
    commitAll(sandbox.path);
    const initialized = await spawnGspot(sandbox.path, buildInitArguments(['bash']));
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await writeFile(join(sandbox.path, 'scripts', 'b.sh'), '#!/usr/bin/env bash\necho $1\n');
    expect(runGit(sandbox.path, ['add', '-A']).code).toBe(0);
    const environment = {
        NO_COLOR: '1',
    };
    const commit = runGit(sandbox.path, ['commit', '-qm', 'bad'], environment);
    expect(commit.code).not.toBe(0);
    expect(`${commit.stdout}${commit.stderr}`).toContain('SC2086');
    await writeFile(join(sandbox.path, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "$1"\n');
    expect(runGit(sandbox.path, ['add', '-A']).code).toBe(0);
    const corrected = runGit(sandbox.path, ['commit', '-qm', 'Correct shell input'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    await assertCloneHooks(sandbox.path, environment);
});

test('doctor reports hooks this clone has not installed and accepts them after install', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
    });
    // hooks.enabled turns on the default Git hooks.

    const environment = {};
    readGitOutput(sandbox.path, ['init', '-q']);
    const missing = await spawnGspot(sandbox.path, ['doctor', '--json'], environment);
    expect(missing.code, missing.stdout + missing.stderr).toBe(1);
    expect((JSON.parse(missing.stdout) as DoctorReport).hooks).toContain('not installed; run gspot install');
    const applied = await spawnGspot(sandbox.path, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await spawnGspot(sandbox.path, ['install'], environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const diagnosed = await spawnGspot(sandbox.path, ['doctor', '--json'], environment);
    expect(diagnosed.code, diagnosed.stdout + diagnosed.stderr).toBe(0);
    const report = JSON.parse(diagnosed.stdout) as DoctorReport;
    expect(report.hooks).toBe('installed');
    expect(report.tools.filter(({ state }) => state !== 'ok' && state !== 'system')).toStrictEqual([]);
});

test.each(['', 'app/'])('install from %s points core.hooksPath at .gspot/hooks', async (prefix) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        'app/gspot.toml': buildSandboxSettings([], { tables: '[hooks]\nenabled = false\n' }),
    });

    readGitOutput(sandbox.path, ['init', '-q']);
    const root = join(sandbox.path, prefix);
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await spawnGspot(root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(installed.stdout).toContain('set core.hooksPath to .gspot/hooks');
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe('.gspot/hooks');
});

test('a commit in a linked worktree runs staged checks and blocks a finding', async () => {
    await using sandbox = await testdir();
    const main = join(sandbox.path, 'main');
    const linked = join(sandbox.path, 'linked');

    await createFileTree(main, {
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                hooks: { enabled: true },
                command_check: [
                    {
                        ...buildReportingCheck({ id: 'sandbox/defect', paths: ['src/**'], stage: 'commit' }),
                        command: [process.execPath, '-e', SAMPLE_COMMAND, '{files}'],
                    },
                ],
            }),
        }),
        'src/kept.txt': 'clean\n',
    });
    await installRuntimes(main);
    commitAll(main);
    const environment = {
        NO_COLOR: '1',
    };
    using _environment = overrideEnvironment(environment);
    const applied = await spawnGspot(main, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await spawnGspot(main, ['install'])).toMatchObject({ code: 0 });
    const formatted = await spawnGspot(main, ['check', '--only', 'data-files/taplo-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    commitAll(main);
    readGitOutput(main, ['worktree', 'add', '-q', '-b', 'topic', linked]);
    await installRuntimes(linked);
    expect(await spawnGspot(linked, ['install'])).toMatchObject({ code: 0 });
    await writeFile(join(linked, 'src/added.txt'), 'DEFECT\n');
    readGitOutput(linked, ['add', 'src/added.txt']);
    const blocked = runGit(linked, ['commit', '-qm', 'Defect'], environment);
    expect(blocked.code, blocked.stdout + blocked.stderr).not.toBe(0);
    expect(blocked.stdout + blocked.stderr).toContain('src/added.txt');
    await writeFile(join(linked, 'src/added.txt'), 'clean\n');
    readGitOutput(linked, ['add', 'src/added.txt']);
    const accepted = runGit(linked, ['commit', '-qm', 'Clean'], environment);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});

test('a hook ignores a nested gspot.toml and checks the index at the Git root', async () => {
    await using sandbox = await testdir();
    const project = join(sandbox.path, 'nested config');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: `[rules]
enabled = false
[hooks]
enabled = true
[[command_check]]
id = "project/content"
stage = "commit"
paths = ["source.txt"]
command = ${JSON.stringify([process.execPath, '-e', INDEX_COMMAND])}
`,
        }),
        'nested config/gspot.toml': buildSandboxSettings([], { tables: '[hooks]\nenabled = false\n' }),
        'source.txt': 'invalid\n',
    });
    await installRuntimes(sandbox.path);
    expect(runGit(sandbox.path, ['init', '-q']).code).toBe(0);
    const applied = await spawnGspot(project, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await spawnGspot(project, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe('.gspot/hooks');
    const formatted = await spawnGspot(project, ['check', '--only', 'data-files/taplo-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    expect(runGit(sandbox.path, ['add', '-A']).code).toBe(0);
    await writeFile(join(sandbox.path, 'source.txt'), 'corrected working tree\n');
    const environment = {};
    const rejected = runGit(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout + rejected.stderr).toContain('Indexed defect');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected working tree\n');
    expect(runGit(sandbox.path, ['add', 'source.txt']).code).toBe(0);
    const corrected = runGit(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

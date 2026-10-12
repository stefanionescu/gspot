import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readGitSetting } from '#cli/system/git.ts';
import { openSession } from '#cli/commands/session.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { installCommand } from '#cli/commands/install.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';
import { git, commitAll, gitOutput } from '#tests/setup/git.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { INDEX_COMMAND, SAMPLE_COMMAND } from '#tests/config/hooks.ts';
import { settingsText, reportingCheck } from '#tests/setup/settings.ts';
import { runGspot, spawnGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { toolsPath, sandboxPath, createInstallationRegistry } from '#tests/setup/install.ts';

// A fresh clone installs immutable tools and rejects then accepts a real staged commit.
async function expectCloneHooks(source: string, environment: Record<string, string>): Promise<void> {
    await using cloneRoot = await testdir();
    const clone = join(cloneRoot.path, 'clone');
    const cloned = git(source, ['clone', '--quiet', '--no-local', source, clone]);
    expect(cloned.code, cloned.stdout + cloned.stderr).toBe(0);
    const uninstalled = await checkReport(clone, ['check', '--only', 'bash/shellcheck', '--json']);
    expect(uninstalled.code, uninstalled.stdout + uninstalled.stderr).toBe(0);
    expect(uninstalled.report).toMatchObject({
        stage: 'all',
        checks: [{ check: 'bash/shellcheck', scope: '', status: 'passed', fileCount: 2, findings: [] }],
        exitCode: 0,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
        const installation = await spawnGspot(clone, ['install']);
        expect(installation.code, installation.stdout + installation.stderr).toBe(0);
        const status = git(clone, ['status', '--porcelain']);
        expect(status.code, status.stderr).toBe(0);
        expect(status.stdout).toBe('');
    }
    const ready = await spawnGspot(clone, ['check', '--only', 'bash/shellcheck']);
    expect(ready.code, ready.stdout + ready.stderr).toBe(0);
    await Bun.write(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho $1\n');
    expect(git(clone, ['add', 'scripts/b.sh']).code).toBe(0);
    const rejected = git(clone, ['commit', '-qm', 'Unquoted shell input'], environment);
    expect(rejected.code).not.toBe(0);
    expect(rejected.stdout + rejected.stderr).toContain('SC2086');
    await Bun.write(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "${1:-ready}"\n');
    expect(git(clone, ['add', 'scripts/b.sh']).code).toBe(0);
    const accepted = git(clone, ['commit', '-qm', 'Quote shell input'], environment);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
}

test('installed and freshly cloned repositories enforce staged findings through real commits', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'scripts/a.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const initialized = await spawnGspot(sandbox.path, buildInitArguments(['bash']));
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await Bun.write(join(sandbox.path, 'scripts', 'b.sh'), '#!/usr/bin/env bash\necho $1\n');
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const environment = {
        PATH: sandboxPath(),
        NO_COLOR: '1',
    };
    const commit = git(sandbox.path, ['commit', '-qm', 'bad'], environment);
    expect(commit.code).not.toBe(0);
    expect(`${commit.stdout}${commit.stderr}`).toContain('SC2086');
    await Bun.write(join(sandbox.path, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "$1"\n');
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const corrected = git(sandbox.path, ['commit', '-qm', 'Correct shell input'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    await expectCloneHooks(sandbox.path, environment);
});

test('doctor reports hooks this clone has not installed and accepts them after install', async () => {
    await using sandbox = await testdir();
    // Explicit hook selection enables the default Git hook integration.
    await createFileTree(sandbox.path, { 'gspot.toml': settingsText([], { tables: '[hooks]\nenabled = true\n' }) });
    const environment = { PATH: toolsPath() };
    gitOutput(sandbox.path, ['init', '-q']);
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
    expect(report.hooks).toContain('.gspot/hooks: installed');
    expect(report.tools.filter(({ state }) => state !== 'ok' && state !== 'system')).toStrictEqual([]);
});

test.each(['', 'app/'])('install points core.hooksPath at %s.gspot/hooks', async (prefix) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        [`${prefix}gspot.toml`]: settingsText([], { tables: '[hooks]\nenabled = true\n' }),
    });
    gitOutput(sandbox.path, ['init', '-q']);
    const root = join(sandbox.path, prefix);
    {
        using log = openOwnershipLog(root);
        const session = await openSession(root);
        writeGeneratedFiles(session, emitAll(session), log);
    }
    await using registry = await createInstallationRegistry(root, runCommand);
    using _environment = useEnvironment(registry.environment);
    const installed = await installCommand(root);
    expect(installed.exitCode, installed.text).toBe(0);
    expect(installed.json).toMatchObject({ installed: true });
    expect(installed.text).toContain(`installed hooks: core.hooksPath is ${prefix}.gspot/hooks`);
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(`${prefix}.gspot/hooks`);
});

test('a commit in a linked worktree runs staged checks and blocks a finding', async () => {
    await using sandbox = await testdir();
    const main = join(sandbox.path, 'main');
    const linked = join(sandbox.path, 'linked');

    await createFileTree(main, {
        'gspot.toml': settingsText([], {
            tables: stringify({
                hooks: { enabled: true },
                command_check: [
                    {
                        ...reportingCheck({ name: 'sandbox/defect', paths: ['src/**'], stage: 'commit' }),
                        command: [process.execPath, '-e', SAMPLE_COMMAND, '{files}'],
                    },
                ],
            }),
        }),
        'src/kept.txt': 'clean\n',
    });
    commitAll(main);
    {
        using log = openOwnershipLog(main);
        await openSession(main).then((session) => writeGeneratedFiles(session, emitAll(session), log));
    }
    await using registry = await createInstallationRegistry(main, runCommand);
    const environment = {
        ...registry.environment,
        PATH: sandboxPath(),
        NO_COLOR: '1',
    };
    using _environment = useEnvironment(environment);
    const applied = await runGspot(main, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const formatted = await runGspot(main, ['check', '--only', 'gspot/settings-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    const prepared = await runGspot(main, ['install'], registry.environment);
    expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    commitAll(main);
    gitOutput(main, ['worktree', 'add', '-q', '-b', 'topic', linked]);
    const installed = await runGspot(linked, ['install'], registry.environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await Bun.write(join(linked, 'src/added.txt'), 'DEFECT\n');
    gitOutput(linked, ['add', 'src/added.txt']);
    const blocked = git(linked, ['commit', '-qm', 'Defect'], environment);
    expect(blocked.code, blocked.stdout + blocked.stderr).not.toBe(0);
    expect(blocked.stdout + blocked.stderr).toContain('src/added.txt');
    await Bun.write(join(linked, 'src/added.txt'), 'clean\n');
    gitOutput(linked, ['add', 'src/added.txt']);
    const accepted = git(linked, ['commit', '-qm', 'Clean'], environment);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});

test('a hook uses the gspot.toml below the Git root and checks the index', async () => {
    await using sandbox = await testdir();
    const project = join(sandbox.path, 'nested config');
    await createFileTree(sandbox.path, {
        'nested config/gspot.toml': `configurations = []
[rules]
enabled = false
[hooks]
enabled = true
[[command_check]]
name = "project/content"
stage = "commit"
paths = ["source.txt"]
command = ${JSON.stringify([process.execPath, '-e', INDEX_COMMAND])}
`,
        'nested config/source.txt': 'invalid\n',
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    {
        using log = openOwnershipLog(project);
        const session = await openSession(project);
        writeGeneratedFiles(session, emitAll(session), log);
    }
    await using registry = await createInstallationRegistry(project, runCommand);
    const applied = await runGspot(project, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const formatted = await runGspot(project, ['check', '--only', 'gspot/settings-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    const installed = await runGspot(project, ['install'], registry.environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    await Bun.write(join(project, 'source.txt'), 'corrected working tree\n');
    const environment = {
        ...registry.environment,
        PATH: sandboxPath(),
    };
    const rejected = git(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout + rejected.stderr).toContain('Indexed defect');
    expect(await Bun.file(join(project, 'source.txt')).text()).toBe('corrected working tree\n');
    expect(git(sandbox.path, ['add', 'nested config/source.txt']).code).toBe(0);
    const corrected = git(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

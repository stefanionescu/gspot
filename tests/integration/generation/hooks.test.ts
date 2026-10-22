import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { readGitSetting } from '#cli/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { readRuntimePins } from '#tests/setup/runner/checkout.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/sandbox.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { runGit, commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { MISE_TRUST, PINNED_TOOLS_FILE } from '#tests/data/setup/runner.ts';
import { INDEX_COMMAND, SAMPLE_COMMAND } from '#tests/data/generation/hooks.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, spawnGspot, parseCheckReport, buildInitArguments } from '#tests/setup/cli/commands.ts';

/** Check that a fresh clone installs the locked tools, then rejects and accepts a real staged commit. */
async function assertCloneHooks(source: string, environment: Record<string, string>): Promise<void> {
    await using cloneRoot = await testdir();
    const clone = join(cloneRoot.path, 'clone');
    const cloned = runGit(source, ['clone', '--quiet', '--no-local', source, clone]);
    expect(cloned.code, cloned.stdout + cloned.stderr).toBe(0);
    await writeRuntimePins(clone);
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

test('a commit with a ShellCheck finding fails through the installed hook, in the repository and in a fresh clone, and passes after the fix', async () => {
    await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });

    await writeRuntimePins(sandbox.path);
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
    await writeRuntimePins(main);
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
    runGitStep(main, ['worktree', 'add', '-q', '-b', 'topic', linked]);
    await writeRuntimePins(linked);
    expect(await spawnGspot(linked, ['install'])).toMatchObject({ code: 0 });
    await writeFile(join(linked, 'src/added.txt'), 'DEFECT\n');
    runGitStep(linked, ['add', 'src/added.txt']);
    const blocked = runGit(linked, ['commit', '-qm', 'Defect'], environment);
    expect(blocked.code, blocked.stdout + blocked.stderr).not.toBe(0);
    expect(blocked.stdout + blocked.stderr).toContain('src/added.txt');
    await writeFile(join(linked, 'src/added.txt'), 'clean\n');
    runGitStep(linked, ['add', 'src/added.txt']);
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
    await writeRuntimePins(sandbox.path);
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

/** Give a hook repository the Bun and Node pins of this repository; a clone keeps its committed file. */
async function writeRuntimePins(root: string): Promise<void> {
    if (!(await isOnDisk(join(root, PINNED_TOOLS_FILE)))) {
        const tools = await readRuntimePins();
        await writeFile(join(root, PINNED_TOOLS_FILE), stringify({ tools }));
    }
    const trusted = await runCommand([...MISE_TRUST, PINNED_TOOLS_FILE], { cwd: root });
    if (trusted.code !== 0) throw new Error(`Sandbox runtime trust failed: ${trusted.stdout}${trusted.stderr}`);
}

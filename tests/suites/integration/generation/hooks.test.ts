import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { readGitSetting } from '#cli/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { readRuntimePins } from '#tests/setup/runner/run-folder.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { MISE_TRUST, TOOL_PINS_FILE } from '#tests/config/setup/runner.ts';
import { runGit, commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/checks/language/bash/sandbox.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, spawnGspot, parseCheckReport, buildInitArguments } from '#tests/setup/cli/commands.ts';
import { INDEX_COMMAND, SAMPLE_COMMAND, UNQUOTED_FINDING_LINE } from '#tests/config/integration/generation/hooks.ts';

/** Check that a fresh clone installs the locked tools, then rejects and accepts a real staged commit. */
async function assertCloneHooks(source: string, environment: Record<string, string>): Promise<void> {
    await using cloneRoot = await testdir();
    const clone = join(cloneRoot.path, 'clone');
    runGitStep(source, ['clone', '--quiet', '--no-local', source, clone]);
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
        expect(runGitStep(clone, ['status', '--porcelain'])).toBe('');
    }
    const ready = await spawnGspot(clone, ['check', '--only', 'bash/shellcheck']);
    expect(ready.code, ready.stdout + ready.stderr).toBe(0);
    await writeFile(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho $1\n');
    runGitStep(clone, ['add', 'scripts/b.sh']);
    const rejected = runGit(clone, ['commit', '-qm', 'Unquoted shell input'], environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect((rejected.stdout + rejected.stderr).split('\n')).toContain(UNQUOTED_FINDING_LINE);
    await writeFile(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "${1:-ready}"\n');
    runGitStep(clone, ['add', 'scripts/b.sh']);
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
    runGitStep(sandbox.path, ['add', '-A']);
    const environment = { NO_COLOR: '1' };
    const commit = runGit(sandbox.path, ['commit', '-qm', 'bad'], environment);
    expect(commit.code, commit.stdout + commit.stderr).toBe(1);
    expect((commit.stdout + commit.stderr).split('\n')).toContain(UNQUOTED_FINDING_LINE);
    await writeFile(join(sandbox.path, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "$1"\n');
    runGitStep(sandbox.path, ['add', '-A']);
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
    const environment = { NO_COLOR: '1' };
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
    expect(blocked.code, blocked.stdout + blocked.stderr).toBe(1);
    expect((blocked.stdout + blocked.stderr).split('\n')).toContain('  src/added.txt');
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
            tables: stringify({
                rules: { enabled: false },
                hooks: { enabled: true },
                command_check: [
                    {
                        id: 'project/content',
                        stage: 'commit',
                        paths: ['source.txt'],
                        command: [process.execPath, '-e', INDEX_COMMAND],
                    },
                ],
            }),
        }),
        'nested config/gspot.toml': buildSandboxSettings([], { tables: '[hooks]\nenabled = false\n' }),
        'source.txt': 'invalid\n',
    });
    await writeRuntimePins(sandbox.path);
    runGitStep(sandbox.path, ['init', '-q']);
    const applied = await spawnGspot(project, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await spawnGspot(project, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
    const formatted = await spawnGspot(project, ['check', '--only', 'data-files/taplo-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    runGitStep(sandbox.path, ['add', '-A']);
    await writeFile(join(sandbox.path, 'source.txt'), 'corrected working tree\n');
    const rejected = runGit(sandbox.path, ['hook', 'run', 'pre-commit']);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect((rejected.stdout + rejected.stderr).split('\n')).toContain('  source.txt:1  Indexed defect');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected working tree\n');
    runGitStep(sandbox.path, ['add', 'source.txt']);
    const corrected = runGit(sandbox.path, ['hook', 'run', 'pre-commit']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

/** Give a hook repository the Bun and Node pins of this repository; a clone keeps its committed file. */
async function writeRuntimePins(root: string): Promise<void> {
    if (!(await isOnDisk(join(root, TOOL_PINS_FILE)))) {
        const tools = await readRuntimePins();
        await writeFile(join(root, TOOL_PINS_FILE), stringify({ tools }));
    }
    const trusted = await runCommand([...MISE_TRUST, TOOL_PINS_FILE], { cwd: root });
    if (trusted.code !== 0) throw new Error(`Sandbox runtime trust failed: ${trusted.stdout}${trusted.stderr}`);
}

import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readGitSetting } from '#cli/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { HOOKS_SETTINGS } from '#tests/config/hooks.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { runtimePinsSchema } from '#tests/schemas/runner.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { MISE_TRUST, TOOL_PINS_FILE } from '#tests/config/setup/runner.ts';
import { runCommand, runCommandBlocking } from '#tests/setup/system/processes.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, spawnGspot, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    UNQUOTED_SCRIPT,
    HOOKS_OFF_SETTINGS,
    UNQUOTED_FINDING_PREFIX,
} from '#tests/config/integration/installers/hooks.ts';

test.each(['', 'app/'])('install from %s points core.hooksPath at .gspot/hooks', async (prefix) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
        'app/gspot.toml': buildSandboxSettings([], { tables: HOOKS_OFF_SETTINGS }),
    });

    const root = join(sandbox.path, prefix);
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await spawnGspot(root, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(installed.stdout.split('\n')).toContain(`set core.hooksPath to ${GSPOT_PATHS.hooks}`);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
});

test('doctor reports hooks this clone has not installed and accepts them after install', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: HOOKS_SETTINGS }),
    });

    const missing = await spawnGspot(sandbox.path, ['doctor', '--json']);
    expect(missing.code, missing.stdout + missing.stderr).toBe(1);
    expect((JSON.parse(missing.stdout) as DoctorReport).hooks).toBe('not installed; run gspot install');
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const diagnosed = await spawnGspot(sandbox.path, ['doctor', '--json']);
    expect(diagnosed.code, diagnosed.stdout + diagnosed.stderr).toBe(0);
    const report = JSON.parse(diagnosed.stdout) as DoctorReport;
    expect(report.hooks).toBe('installed');
    expect(report.tools.filter(({ state }) => state !== 'ok' && state !== 'system')).toStrictEqual([]);
});

async function assertCloneHooks(source: string, environment: Record<string, string>): Promise<void> {
    await using cloneRoot = await createGitSandbox({});
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
    for (let round = 0; round < 2; round++) {
        const installation = await spawnGspot(clone, ['install']);
        expect(installation.code, installation.stdout + installation.stderr).toBe(0);
        expect(runGitStep(clone, ['status', '--porcelain'])).toBe('');
    }
    const ready = await spawnGspot(clone, ['check', '--only', 'bash/shellcheck']);
    expect(ready.code, ready.stdout + ready.stderr).toBe(0);
    await writeFile(join(clone, 'scripts/b.sh'), UNQUOTED_SCRIPT);
    runGitStep(clone, ['add', 'scripts/b.sh']);
    const rejected = runCommandBlocking(['git', 'commit', '-qm', 'Unquoted shell input'], {
        cwd: clone,
        env: environment,
    });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(
        (rejected.stdout + rejected.stderr).split('\n').some((line) => line.startsWith(UNQUOTED_FINDING_PREFIX)),
    ).toBe(true);
    await writeFile(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "${1:-ready}"\n');
    runGitStep(clone, ['add', 'scripts/b.sh']);
    const accepted = runCommandBlocking(['git', 'commit', '-qm', 'Quote shell input'], {
        cwd: clone,
        env: environment,
    });
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
}

test('a commit with a ShellCheck finding fails through the installed hook, in the repository and in a fresh clone, and passes after the fix', async () => {
    await using sandbox = await testdir({ 'scripts/a.sh': CLEAN_BASH_SCRIPT });

    await writeRuntimePins(sandbox.path);
    commitAll(sandbox.path);
    const initialized = await spawnGspot(sandbox.path, ['init', '--yes', '--configurations', 'bash']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await writeFile(join(sandbox.path, 'scripts', 'b.sh'), UNQUOTED_SCRIPT);
    runGitStep(sandbox.path, ['add', '-A']);
    const environment = { NO_COLOR: '1' };
    const commit = runCommandBlocking(['git', 'commit', '-qm', 'bad'], { cwd: sandbox.path, env: environment });
    expect(commit.code, commit.stdout + commit.stderr).toBe(1);
    expect((commit.stdout + commit.stderr).split('\n').some((line) => line.startsWith(UNQUOTED_FINDING_PREFIX))).toBe(
        true,
    );
    await writeFile(join(sandbox.path, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "$1"\n');
    runGitStep(sandbox.path, ['add', '-A']);
    const corrected = runCommandBlocking(['git', 'commit', '-qm', 'Correct shell input'], {
        cwd: sandbox.path,
        env: environment,
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    await assertCloneHooks(sandbox.path, environment);
});

test('a commit in a linked worktree runs staged checks and blocks a finding', async () => {
    await using sandbox = await createGitSandbox({});
    const main = join(sandbox.path, 'main');
    const linked = join(sandbox.path, 'linked');

    const files = {
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                hooks: { enabled: true },
                command_check: [
                    {
                        ...buildReportingCheck({ id: 'sandbox/defect', paths: ['src/**'], stage: 'commit' }),
                        command: buildProgramCommand(
                            'checks/search',
                            '--text',
                            'DEFECT',
                            '--report',
                            'path',
                            '--',
                            '{files}',
                        ),
                    },
                ],
            }),
        }),
        'src/kept.txt': 'clean\n',
    };
    await createFileTree(main, files);
    await writeRuntimePins(main);
    commitAll(main);
    const environment = { NO_COLOR: '1' };
    await applyThenInstall(main);
    const formatted = await spawnGspot(main, ['check', '--only', 'data-files/taplo-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    commitAll(main);
    runGitStep(main, ['worktree', 'add', '-q', '-b', 'topic', linked]);
    await writeRuntimePins(linked);
    const installed = await spawnGspot(linked, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await writeFile(join(linked, 'src/added.txt'), 'DEFECT\n');
    runGitStep(linked, ['add', 'src/added.txt']);
    const blocked = runCommandBlocking(['git', 'commit', '-qm', 'Defect'], { cwd: linked, env: environment });
    expect(blocked.code, blocked.stdout + blocked.stderr).toBe(1);
    expect((blocked.stdout + blocked.stderr).split('\n')).toContain('  src/added.txt');
    await writeFile(join(linked, 'src/added.txt'), 'clean\n');
    runGitStep(linked, ['add', 'src/added.txt']);
    const accepted = runCommandBlocking(['git', 'commit', '-qm', 'Clean'], { cwd: linked, env: environment });
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
});

test('a hook ignores a nested gspot.toml and checks the index at the Git root', async () => {
    await using sandbox = await createGitSandbox({});
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
                        command: buildProgramCommand(
                            'checks/search',
                            '--text',
                            'invalid',
                            '--report',
                            'message',
                            '--message',
                            'Indexed defect',
                            'source.txt',
                        ),
                    },
                ],
            }),
        }),
        'nested config/gspot.toml': buildSandboxSettings([], { tables: HOOKS_OFF_SETTINGS }),
        'source.txt': 'invalid\n',
    });
    await writeRuntimePins(sandbox.path);
    const applied = await spawnGspot(project, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await spawnGspot(project, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await readGitSetting(sandbox.path, 'core.hooksPath')).toBe(GSPOT_PATHS.hooks);
    const formatted = await spawnGspot(project, ['check', '--only', 'data-files/taplo-format', '--fix']);
    expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    runGitStep(sandbox.path, ['add', '-A']);
    await writeFile(join(sandbox.path, 'source.txt'), 'corrected working tree\n');
    const rejected = runCommandBlocking(['git', 'hook', 'run', 'pre-commit'], { cwd: sandbox.path, env: {} });
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect((rejected.stdout + rejected.stderr).split('\n')).toContain('  source.txt:1  Indexed defect');
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('corrected working tree\n');
    runGitStep(sandbox.path, ['add', 'source.txt']);
    const corrected = runCommandBlocking(['git', 'hook', 'run', 'pre-commit'], { cwd: sandbox.path, env: {} });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

async function writeRuntimePins(root: string): Promise<void> {
    if (!(await isOnDisk(join(root, TOOL_PINS_FILE)))) {
        const tools = runtimePinsSchema.parse(
            parse(await readFile(join(REPOSITORY_ROOT, TOOL_PINS_FILE), 'utf8')),
        ).tools;
        await writeFile(join(root, TOOL_PINS_FILE), stringify({ tools }));
    }
    const trusted = await runCommand([...MISE_TRUST, TOOL_PINS_FILE], { cwd: root });
    if (trusted.code !== 0) throw new Error(`Sandbox runtime trust failed: ${trusted.stdout}${trusted.stderr}`);
}

// A missing shell tool reports its pinned version and install hint; the available tool checks the same script.
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { buildPolicy } from '#tests/harness/policy.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/samples/bash.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { unlink, symlink, readFile, writeFile } from 'node:fs/promises';
import { runGspot, spawnGspot, checkReport } from '#tests/harness/gspot.ts';

test('a missing tool fails with the install hint', async () => {
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
    await symlink(process.execPath, join(bin, process.platform === 'win32' ? 'bun.exe' : 'bun'));
    // Git for Windows finds its installation from the folder git.exe sits in, which holds no lint tool.
    if (process.platform !== 'win32') await symlink(gitPath!, join(bin, 'git'));
    const path = process.platform === 'win32' ? `${bin}${delimiter}${dirname(gitPath!)}` : bin;
    const environment = {
        PATH: path,
        HOME: join(sandbox.path, 'home'),
        MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
    };
    const initialized = await spawnGspot(sandbox.path, buildInitArguments(['bash'], { hooks: true }), {
        ...environment,
        PATH: buildToolsPath([]),
    });
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(initialized.stdout + initialized.stderr).toContain('run gspot check');
    const check = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck'], environment);
    expect(check.code).toBe(2);
    expect(check.stdout).toContain('missing');
    expect(check.stdout).toContain(
        `shellcheck ${String(toolPin([...configurationManifests().values()], 'shellcheck').version)} is not installed`,
    );
    const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const missing = await spawnGspot(sandbox.path, ['check', '--only', 'bash/function-size'], environment);
    expect(missing.code).toBe(2);
    expect(missing.stdout).toContain('missing');
    expect(missing.stdout).toContain('Run: gspot install');
    const available = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']);
    expect(available.code, available.stdout + available.stderr).toBe(0);
    expect((JSON.parse(available.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/shellcheck', status: 'passed', findings: [] },
    ]);
});

test('a global ignore stops a command check and its correction command until removed', async () => {
    await using directory = await testdir();
    const command = ['bash', '-c', 'printf executed > read.txt; exit 1'];
    const fix = ['bash', '-c', 'printf corrected > corrected.txt'];
    const policy = buildPolicy([], {
        tables: `[check."project/quality"]\ncommand = ${JSON.stringify(command)}\nfix = ${JSON.stringify(fix)}\npaths = ["entry.sh"]\nstage = "commit"\n`,
    });
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const args = ['check', '--only', 'project/quality', '--json'];
    const before = await runGspot(directory.path, args);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    expect(await readFile(join(directory.path, 'read.txt'), 'utf8')).toBe('executed');
    await unlink(join(directory.path, 'read.txt'));
    const reason = 'The sandbox preserves the command failure.';
    const ignored = await runGspot(directory.path, ['ignore', 'project/quality', '--reason', reason]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const skipped = await checkReport(directory.path, [...args, '--fix']);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    const report = skipped.report;
    expect(report.checks[0]).toMatchObject({ check: 'project/quality', status: 'skipped', findings: [] });
    expect(report.skips).toStrictEqual([{ check: 'project/quality', cause: 'ignore' }]);
    expect(report.ignores).toStrictEqual([{ check: 'project/quality', reason, matched: 0 }]);
    expect(await pathExists(join(directory.path, 'read.txt'))).toBe(false);
    expect(await pathExists(join(directory.path, 'corrected.txt'))).toBe(false);
    const removed = await runGspot(directory.path, ['ignore', 'project/quality', '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await runGspot(directory.path, args);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(await readFile(join(directory.path, 'read.txt'), 'utf8')).toBe('executed');
});

test('an ignored folder includes descendants while a negated file remains enforced', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash']),
        'legacy scripts/nested/example.sh': 'if then\n',
        'legacy scripts/required.sh': 'if then\n',
        'entry.sh': 'echo example\n',
    });
    const ignored = await runGspot(directory.path, [
        'ignore',
        'bash/bash-syntax',
        '--reason',
        'The legacy files retain malformed syntax.',
        '--paths',
        'legacy scripts',
        '!legacy scripts/required.sh',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const command = ['check', '--only', 'bash/bash-syntax', '--json'];
    const checked = await checkReport(directory.path, command);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
    expect(new Set(report.checks[0]?.findings.map(({ file }) => file))).toStrictEqual(
        new Set(['legacy scripts/required.sh']),
    );
    expect(report.ignores[0]?.matched).toBe(0);
    await writeFile(join(directory.path, 'legacy scripts/required.sh'), 'echo corrected\n');
    const corrected = await runGspot(directory.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const removed = await runGspot(directory.path, [
        'ignore',
        'bash/bash-syntax',
        '--reason',
        'The legacy files retain malformed syntax.',
        '--paths',
        'legacy scripts',
        '!legacy scripts/required.sh',
        '--remove',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await checkReport(directory.path, command);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(new Set(restored.report.checks[0]?.findings.map(({ file }) => file))).toStrictEqual(
        new Set(['legacy scripts/nested/example.sh']),
    );
});

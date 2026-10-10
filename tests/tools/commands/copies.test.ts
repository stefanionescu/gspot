import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { unlink, readFile, writeFile } from 'node:fs/promises';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { CommandFailureJson } from '#cli/types/terminal.ts';

const { version: RUNNING_VERSION } = packageManifest;

test('staged checks use index bytes and policy on an unborn branch while preserving unstaged edits', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['bash']);
    await createFileTree(directory.path, { 'gspot.toml': policy, 'script with spaces.sh': 'if then\n' });
    gitOutput(directory.path, ['init', '-q']);
    gitOutput(directory.path, ['add', '-A']);
    const index = gitOutput(directory.path, ['ls-files', '--stage', '-z']);
    await writeFile(join(directory.path, 'script with spaces.sh'), 'echo repaired only in the working tree\n');
    await writeFile(join(directory.path, 'gspot.toml'), 'invalid working policy');
    const args = ['check', '--staged', '--only', 'bash/bash-syntax', '--json'];
    const failed = await checkReport(directory.path, args);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const failedReport = failed.report;
    expect(failedReport.comparison?.content).toBe('index');
    expect(failedReport.checks[0]?.reproduce).toContain('--staged');
    expect(new Set(failedReport.checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['script with spaces.sh']),
    );
    expect(gitOutput(directory.path, ['ls-files', '--stage', '-z'])).toBe(index);
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe('invalid working policy');
    expect(await readFile(join(directory.path, 'script with spaces.sh'), 'utf8')).toBe(
        'echo repaired only in the working tree\n',
    );
    await writeFile(join(directory.path, 'gspot.toml'), policy);
    gitOutput(directory.path, ['add', 'gspot.toml', 'script with spaces.sh']);
    await writeFile(join(directory.path, 'script with spaces.sh'), 'if then\n');
    const passed = await checkReport(directory.path, args);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    const passedReport = passed.report;
    expect(passedReport.checks[0]?.status).toBe('passed');
    expect(passedReport.comparison?.reference).not.toBe(failedReport.comparison?.reference);
    expect(await readFile(join(directory.path, 'script with spaces.sh'), 'utf8')).toBe('if then\n');
});

test('staged checks read an indexed file when its working file is missing', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash']),
        'script with spaces.sh': 'echo indexed\n',
    });
    gitOutput(directory.path, ['init', '-q']);
    gitOutput(directory.path, ['add', '-A']);
    const args = ['check', '--staged', '--only', 'bash/bash-syntax', '--json'];
    await unlink(join(directory.path, 'script with spaces.sh'));
    const ran = await checkReport(directory.path, args);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(ran.report.checks[0]).toMatchObject({ status: 'passed', fileCount: 1 });
    expect(await pathExists(join(directory.path, 'script with spaces.sh'))).toBe(false);
});

test('staged checks validate the index version pin instead of the working pin', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash']),
        '.gspot/version': '0.0.0\n',
        'script.sh': 'echo valid\n',
    });
    gitOutput(directory.path, ['init', '-q']);
    gitOutput(directory.path, ['add', '-A']);
    await writeFile(join(directory.path, '.gspot/version'), `${RUNNING_VERSION}\n`);
    const args = ['check', '--staged', '--only', 'bash/bash-syntax', '--json'];
    const refused = await runGspot(directory.path, args);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).error).toBe('pin');
    gitOutput(directory.path, ['add', '.gspot/version']);
    await writeFile(join(directory.path, '.gspot/version'), '0.0.0\n');
    const accepted = await runGspot(directory.path, args);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(await readFile(join(directory.path, '.gspot/version'), 'utf8')).toBe('0.0.0\n');
});

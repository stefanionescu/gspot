import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import type { RunReport } from '#cli/types/execution/execution.ts';

test('a global ignore stops a repository check and its correction command until removed', async () => {
    await using directory = await testdir();
    const command = ['bash', '-c', 'printf executed > read.txt; exit 1'];
    const fix = ['bash', '-c', 'printf corrected > corrected.txt'];
    const policy = policyOf(
        [],
        `[rules]\ninstall = false\n[[check]]\nname = "project/quality"\ncommand = ${JSON.stringify(command)}\nfix = ${JSON.stringify(fix)}\npaths = ["entry.sh"]\nstage = "commit"\n`,
    );
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const args = ['check', '--only', 'project/quality', '--json'];
    const before = await runGspot(directory.path, args);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    expect(readFileSync(join(directory.path, 'read.txt'), 'utf8')).toBe('executed');
    unlinkSync(join(directory.path, 'read.txt'));
    const ignored = await runGspot(directory.path, ['ignore', 'project/quality']);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const skipped = await runGspot(directory.path, [...args, '--fix']);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    const report = JSON.parse(skipped.stdout) as RunReport;
    expect(report.checks[0]).toMatchObject({ check: 'project/quality', status: 'skipped', findings: [] });
    expect(report.skips).toStrictEqual([{ check: 'project/quality', cause: 'ignore' }]);
    expect(report.ignores).toStrictEqual([{ check: 'project/quality', matched: 0 }]);
    expect(existsSync(join(directory.path, 'read.txt'))).toBe(false);
    expect(existsSync(join(directory.path, 'corrected.txt'))).toBe(false);
    const removed = await runGspot(directory.path, ['ignore', 'project/quality', '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await runGspot(directory.path, args);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(readFileSync(join(directory.path, 'read.txt'), 'utf8')).toBe('executed');
});

// A check that records what it saw and passes corrected inputs, and a fixer that corrects them.
const QUALITY_COMMAND = [
    'node',
    '-e',
    String.raw`const fs = require("node:fs"); const paths = process.argv.slice(1); fs.appendFileSync("checked.txt", JSON.stringify(paths) + "\n"); process.exit(paths.some(path => fs.readFileSync(path, "utf8") !== "corrected\n") ? 1 : 0);`,
    '--',
    '{files}',
];
const QUALITY_FIX = [
    'node',
    '-e',
    String.raw`const fs = require("node:fs"); const paths = process.argv.slice(1); fs.appendFileSync("fixed.txt", JSON.stringify(paths) + "\n"); for (const path of paths) fs.writeFileSync(path, "corrected\n");`,
    '--',
    '{files}',
];

test('path-specific ignores prevent checker and fixer execution and report an entirely ignored selection', async () => {
    await using directory = await testdir();
    const policy = policyOf(
        [],
        `[rules]\ninstall = false\n[[check]]\nname = "project/quality"\ncommand = ${JSON.stringify(QUALITY_COMMAND)}\nfix = ${JSON.stringify(QUALITY_FIX)}\npaths = ["inputs/**"]\nstage = "commit"\n[[ignore]]\ncheck = "project/quality"\npaths = ["inputs/skip*", "!inputs/skip-keep.txt"]\n`,
    );
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'inputs/regular.txt': 'defect\n',
        'inputs/skip café.txt': 'defect\n',
        'inputs/skip-keep.txt': 'defect\n',
    });
    const args = ['check', '--only', 'project/quality', '--fix', '--json'];
    const corrected = await runGspot(directory.path, args);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const report = JSON.parse(corrected.stdout) as RunReport;
    expect(report.checks[0]).toMatchObject({ status: 'passed', fileCount: 2, findings: [] });
    // A second correction pass reruns the fixer over the files the first pass changed.
    for (const log of ['checked.txt', 'fixed.txt'])
        for (const line of readFileSync(join(directory.path, log), 'utf8').trim().split('\n'))
            expect((JSON.parse(line) as string[]).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
                'inputs/regular.txt',
                'inputs/skip-keep.txt',
            ]);
    expect(readFileSync(join(directory.path, 'inputs/skip café.txt'), 'utf8')).toBe('defect\n');
    const checked = readFileSync(join(directory.path, 'checked.txt'), 'utf8');
    const fixed = readFileSync(join(directory.path, 'fixed.txt'), 'utf8');
    const skipped = await runGspot(directory.path, [...args, '--', 'inputs/skip café.txt']);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    const skippedReport = JSON.parse(skipped.stdout) as RunReport;
    expect(skippedReport.skips).toStrictEqual([{ check: 'project/quality', cause: 'ignore' }]);
    expect(skippedReport.checks[0]).toMatchObject({ status: 'skipped', findings: [] });
    expect(readFileSync(join(directory.path, 'checked.txt'), 'utf8')).toBe(checked);
    expect(readFileSync(join(directory.path, 'fixed.txt'), 'utf8')).toBe(fixed);
    const restored = await runGspot(directory.path, [
        'ignore',
        'project/quality',
        '--remove',
        '--paths',
        'inputs/skip*',
        '!inputs/skip-keep.txt',
    ]);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    const accepted = await runGspot(directory.path, [...args, '--', 'inputs/skip café.txt']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(readFileSync(join(directory.path, 'inputs/skip café.txt'), 'utf8')).toBe('corrected\n');
});

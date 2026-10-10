import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { unlink, readFile, writeFile } from 'node:fs/promises';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import { TWO_RULES, QUALITY_FIX, IGNORE_CASES, QUALITY_COMMAND } from '#tests/config/cli/commands/ignore.ts';

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

test('path-specific ignores prevent checker and fixer execution and report an entirely ignored selection', async () => {
    await using directory = await testdir();
    const policy = buildPolicy([], {
        tables: `[check."project/quality"]\ncommand = ${JSON.stringify(QUALITY_COMMAND)}\nfix = ${JSON.stringify(QUALITY_FIX)}\npaths = ["inputs/**"]\nstage = "commit"\n[[ignore]]\ncheck = "project/quality"\npaths = ["inputs/skip*", "!inputs/skip-keep.txt"]\nreason = "The skipped input preserves the sample."\n`,
    });
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'inputs/regular.txt': 'defect\n',
        'inputs/skip café.txt': 'defect\n',
        'inputs/skip-keep.txt': 'defect\n',
    });
    const args = ['check', '--only', 'project/quality', '--fix', '--json'];
    const corrected = await checkReport(directory.path, args);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const report = corrected.report;
    expect(report.checks[0]).toMatchObject({ status: 'passed', fileCount: 2, findings: [] });
    // A second correction pass reruns the fixer over the files the first pass changed.
    for (const log of ['checked.txt', 'fixed.txt']) {
        const entries = await readFile(join(directory.path, log), 'utf8');
        for (const line of entries.trim().split('\n'))
            expect((JSON.parse(line) as string[]).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
                'inputs/regular.txt',
                'inputs/skip-keep.txt',
            ]);
    }
    expect(await readFile(join(directory.path, 'inputs/skip café.txt'), 'utf8')).toBe('defect\n');
    const checked = await readFile(join(directory.path, 'checked.txt'), 'utf8');
    const fixed = await readFile(join(directory.path, 'fixed.txt'), 'utf8');
    const skipped = await checkReport(directory.path, [...args, '--', 'inputs/skip café.txt']);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    const skippedReport = skipped.report;
    expect(skippedReport.skips).toStrictEqual([{ check: 'project/quality', cause: 'ignore' }]);
    expect(skippedReport.checks[0]).toMatchObject({ status: 'skipped', findings: [] });
    expect(await readFile(join(directory.path, 'checked.txt'), 'utf8')).toBe(checked);
    expect(await readFile(join(directory.path, 'fixed.txt'), 'utf8')).toBe(fixed);
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
    expect(await readFile(join(directory.path, 'inputs/skip café.txt'), 'utf8')).toBe('corrected\n');
});

test.each([...IGNORE_CASES])(
    'ignore with %s exits %d and leaves gspot.toml byte for byte',
    async (_, argv, code, expected) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'gspot.toml': TWO_RULES, 'entry.sh': 'echo example\n' });
        const result = await runGspot(directory.path, [...argv]);
        expect(result.code, result.stdout + result.stderr).toBe(code);
        expect(result.stdout + result.stderr).toContain(expected);
        expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(TWO_RULES);
    },
);

test('merged ignores print saved paths and allow individual paths to be removed', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            '# Comment on configurations.\n' +
            buildPolicy(['bash'], {
                agentRules: true,
                tables: '[agent_rules]\nenabled = false\n[hooks]\n# Keep the push selection.\npush_files = "changed"\n',
            }),
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
    });
    const args = ['ignore', 'bash/shellcheck', '--reason', 'The inputs demonstrate word splitting.', '--paths'];
    const first = await runGspot(directory.path, [...args, 'a.sh']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const added = await runGspot(directory.path, [...args, 'b.sh']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    expect(added.stdout).toContain('a.sh');
    expect(added.stdout).toContain('b.sh');
    const removed = await runGspot(directory.path, ['ignore', 'bash/shellcheck', '--remove', '--paths', 'b.sh']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const saved = await readFile(join(directory.path, 'gspot.toml'), 'utf8');
    expect(saved).toContain('a.sh');
    expect(saved).not.toContain('b.sh');
    expect(saved).toContain('# Comment on configurations.');
    expect(saved).toContain('# Keep the push selection.');
    expect(saved.indexOf('[hooks]')).toBeLessThan(saved.indexOf('[[ignore]]'));
});

test('ignore merges matching expiry dates and removes only the selected expiry', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash'], { agentRules: true, tables: '[agent_rules]\nenabled = false\n' }),
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
        'c.sh': 'echo c\n',
    });
    const args = ['ignore', 'bash/shellcheck', '--rule', 'SC2086', '--reason', 'The sandbox preserves word splitting.'];
    for (const [until, path] of [
        ['2099-05-20', 'a.sh'],
        ['2099-05-20', 'b.sh'],
        ['2099-05-21', 'c.sh'],
    ]) {
        const saved = await runGspot(directory.path, [...args, '--until', until!, '--paths', path!]);
        expect(saved.code, saved.stdout + saved.stderr).toBe(0);
    }
    const entry = { check: 'bash/shellcheck', rule: 'SC2086', reason: 'The sandbox preserves word splitting.' };
    const readEntries = async () =>
        parseStrictPolicy(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).ignore.map((entry) => ({
            ...entry,
            until: entry.until?.toISOString(),
        }));
    expect(await readEntries()).toStrictEqual([
        {
            ...entry,
            until: '2099-05-20',
            paths: ['a.sh', 'b.sh'],
        },
        {
            ...entry,
            until: '2099-05-21',
            paths: ['c.sh'],
        },
    ]);
    const removed = await runGspot(directory.path, [
        'ignore',
        'bash/shellcheck',
        '--rule',
        'SC2086',
        '--until',
        '2099-05-20',
        '--paths',
        'b.sh',
        '--remove',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(await readEntries()).toStrictEqual([
        {
            ...entry,
            until: '2099-05-20',
            paths: ['a.sh'],
        },
        {
            ...entry,
            until: '2099-05-21',
            paths: ['c.sh'],
        },
    ]);
});

test('ignore rejects an invalid expiry without changing authored policy', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash']),
        'example.sh': 'echo ready\n',
    });
    const before = await readFile(join(directory.path, 'gspot.toml'), 'utf8');
    const invalid = await runGspot(directory.path, [
        'ignore',
        'bash/shellcheck',
        '--rule',
        'SC2086',
        '--reason',
        'The sandbox preserves word splitting.',
        '--until',
        '2099-02-30',
    ]);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect(invalid.stdout + invalid.stderr).toContain('until');
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(before);
});

test('ignore combines matching paths, keeps different reasons, and lets a pathless entry cover the whole scope', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash']),
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
        'other.sh': 'echo other\n',
    });
    const reason = 'Generated samples repeat on purpose.';
    const args = ['ignore', 'bash/shellcheck', '--rule', 'SC2312'];
    for (const [paths, explanation] of [
        [['a.sh'], reason],
        [['b.sh', 'a.sh'], reason],
        [['other.sh'], 'Another cause.'],
    ] as const) {
        const result = await runGspot(directory.path, [...args, '--reason', explanation, '--paths', ...paths]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const policyPath = join(directory.path, 'gspot.toml');
    expect(parse(await readFile(policyPath, 'utf8'))['ignore']).toStrictEqual([
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['a.sh', 'b.sh'], reason },
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' },
    ]);
    const everywhere = await runGspot(directory.path, [...args, '--reason', reason]);
    expect(everywhere.code, everywhere.stdout + everywhere.stderr).toBe(0);
    expect(parse(await readFile(policyPath, 'utf8'))['ignore']).toStrictEqual([
        { check: 'bash/shellcheck', rule: 'SC2312', reason },
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' },
    ]);
    const removed = await runGspot(directory.path, [...args, '--reason', reason, '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toContain('removed 1 ignore entry for bash/shellcheck');
    expect(parse(await readFile(policyPath, 'utf8'))['ignore']).toStrictEqual([
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' },
    ]);
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

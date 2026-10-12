import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { TWO_RULES } from '#tests/config/ignore.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { unlink, readFile, writeFile } from 'node:fs/promises';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';

test('ignore of an unknown check exits 2 and leaves gspot.toml byte for byte', async () => {
    await using directory = await testdir({ 'gspot.toml': TWO_RULES, 'entry.sh': 'echo example\n' });
    const result = await runGspot(directory.path, [
        'ignore',
        'bash/shelcheck',
        '--reason',
        'The sample check name is misspelled.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toContain('bash/shellcheck');
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(TWO_RULES);
});

test('ignore merges paths into one entry and prints them, and unignore removes one path', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml':
            '# Comment on configurations.\n' +
            settingsText(['bash'], {
                rules: true,
                tables: `[rules]
enabled = false
[hooks]
# Keep the push selection.
enabled = false
`,
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
    const removed = await runGspot(directory.path, ['unignore', 'bash/shellcheck', '--paths', 'b.sh']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const saved = await readFile(join(directory.path, 'gspot.toml'), 'utf8');
    expect(saved).toContain('a.sh');
    expect(saved).not.toContain('b.sh');
    expect(saved).toContain('# Comment on configurations.');
    expect(saved).toContain('# Keep the push selection.');
    expect(saved.indexOf('[hooks]')).toBeLessThan(saved.indexOf('[[ignore]]'));
});

test('ignore merges entries with the same --until date, keeps other dates apart, and unignore removes one path', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash'], { rules: true, tables: '[rules]\nenabled = false\n' }),
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
        parseSettings(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).ignore.map((entry) => ({
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
        'unignore',
        'bash/shellcheck',
        '--rule',
        'SC2086',
        '--paths',
        'b.sh',
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

test('ignore rejects an invalid expiry without changing authored settings', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash']),
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

test('ignore merges matching paths, keeps different reasons apart, and an entry without paths covers the scope', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash']),
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
    const settingsPath = join(directory.path, 'gspot.toml');
    expect(parse(await readFile(settingsPath, 'utf8'))['ignore']).toStrictEqual([
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['a.sh', 'b.sh'], reason },
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' },
    ]);
    const everywhere = await runGspot(directory.path, [...args, '--reason', reason]);
    expect(everywhere.code, everywhere.stdout + everywhere.stderr).toBe(0);
    expect(parse(await readFile(settingsPath, 'utf8'))['ignore']).toStrictEqual([
        { check: 'bash/shellcheck', rule: 'SC2312', reason },
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' },
    ]);
    const removed = await runGspot(directory.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2312']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toContain('deleted 2 ignores');
    expect(parse(await readFile(settingsPath, 'utf8'))['ignore']).toBeUndefined();
});

test('an ignore without paths stops a command check and its fixer until unignore', async () => {
    await using directory = await testdir();
    const command = ['bash', '-c', 'printf executed > read.txt; exit 1'];
    const fix = ['bash', '-c', 'printf corrected > corrected.txt'];
    const settings = settingsText([], {
        tables: `[[command_check]]
name = "project/quality"
output = { format = "none" }
command = ${JSON.stringify(command)}
fix = ${JSON.stringify(fix)}
paths = ["entry.sh"]
stage = "commit"
`,
    });
    await createFileTree(directory.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
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
    const removed = await runGspot(directory.path, ['unignore', 'project/quality']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await runGspot(directory.path, args);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(await readFile(join(directory.path, 'read.txt'), 'utf8')).toBe('executed');
});

test('an ignored folder covers its subfolders, and a negated file in it is still checked', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash']),
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
        'unignore',
        'bash/bash-syntax',
        '--paths',
        'legacy scripts',
        '!legacy scripts/required.sh',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await checkReport(directory.path, command);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(new Set(restored.report.checks[0]?.findings.map(({ file }) => file))).toStrictEqual(
        new Set(['legacy scripts/nested/example.sh']),
    );
});

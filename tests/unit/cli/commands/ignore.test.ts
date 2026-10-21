import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { unlink, readFile, writeFile } from 'node:fs/promises';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { TWO_IGNORE_RECORDS } from '#tests/data/commands/ignore.ts';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';

test('ignore of an unknown check exits 2 and leaves gspot.toml byte for byte', async () => {
    await using folder = await testdir({ 'gspot.toml': TWO_IGNORE_RECORDS, 'entry.sh': 'echo example\n' });
    const result = await runGspot(folder.path, [
        'ignore',
        'bash/shelcheck',
        '--reason',
        'The sample check name is misspelled.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toContain('bash/shellcheck');
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe(TWO_IGNORE_RECORDS);
});

test('ignore merges paths into one entry and prints them, and unignore removes one path', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml':
            '# Comment on configurations.\n' +
            buildSettingsText(['bash'], {
                rules: true,
                tables:
                    BASH_SYNTAX_CHECK +
                    `[rules]
enabled = false
[hooks]
# Keep the push selection.
enabled = false
`,
            }),
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
    });
    const commandArguments = [
        'ignore',
        'bash/shellcheck',
        '--reason',
        'The inputs demonstrate word splitting.',
        '--paths',
    ];
    const first = await runGspot(folder.path, [...commandArguments, 'a.sh']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const added = await runGspot(folder.path, [...commandArguments, 'b.sh']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    expect(added.stdout).toContain('a.sh');
    expect(added.stdout).toContain('b.sh');
    const removed = await runGspot(folder.path, ['unignore', 'bash/shellcheck', '--paths', 'b.sh']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const saved = await readFile(join(folder.path, 'gspot.toml'), 'utf8');
    expect(saved).toContain('a.sh');
    expect(saved).not.toContain('b.sh');
    expect(saved).toContain('# Comment on configurations.');
    expect(saved).toContain('# Keep the push selection.');
    expect(saved.indexOf('[hooks]')).toBeLessThan(saved.indexOf('[[ignore]]'));
});

test('ignore merges entries with the same --until date, keeps other dates apart, and unignore removes one path', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['bash'], {
            rules: true,
            tables: BASH_SYNTAX_CHECK + '[rules]\nenabled = false\n',
        }),
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
        'c.sh': 'echo c\n',
    });
    const commandArguments = [
        'ignore',
        'bash/shellcheck',
        '--rule',
        'SC2086',
        '--reason',
        'The sandbox preserves word splitting.',
    ];
    for (const [until, path] of [
        ['2099-05-20', 'a.sh'],
        ['2099-05-20', 'b.sh'],
        ['2099-05-21', 'c.sh'],
    ]) {
        const saved = await runGspot(folder.path, [...commandArguments, '--until', until!, '--paths', path!]);
        expect(saved.code, saved.stdout + saved.stderr).toBe(0);
    }
    const entry = { check: 'bash/shellcheck', rule: 'SC2086', reason: 'The sandbox preserves word splitting.' };
    expect(await readIgnoreRecords(folder.path)).toStrictEqual([
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
    const removed = await runGspot(folder.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086', '--paths', 'b.sh']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(await readIgnoreRecords(folder.path)).toStrictEqual([
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

test('ignore refuses an invalid --until date and leaves gspot.toml unchanged', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'example.sh': 'echo ready\n',
    });
    const before = await readFile(join(folder.path, 'gspot.toml'), 'utf8');
    const invalid = await runGspot(folder.path, [
        'ignore',
        'bash/shellcheck',
        '--rule',
        'SC2086',
        '--reason',
        'The sandbox preserves word splitting.',
        '--until',
        '2099-02-30',
        '--json',
    ]);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(2);
    expect(invalid.stderr).toBe('');
    expect(JSON.parse(invalid.stdout)).toStrictEqual({
        error: 'arguments',
        message: '--until must be a valid calendar date in YYYY-MM-DD form.',
    });
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe(before);
});

test('ignore merges matching paths, keeps different reasons apart, and an entry without paths covers the scope', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
        'other.sh': 'echo other\n',
    });
    const reason = 'Generated samples repeat on purpose.';
    const commandArguments = ['ignore', 'bash/shellcheck', '--rule', 'SC2312'];
    for (const [paths, explanation] of [
        [['a.sh'], reason],
        [['b.sh', 'a.sh'], reason],
        [['other.sh'], 'Another cause.'],
    ] as const) {
        const result = await runGspot(folder.path, [...commandArguments, '--reason', explanation, '--paths', ...paths]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const settingsPath = join(folder.path, 'gspot.toml');
    expect((parse(await readFile(settingsPath, 'utf8')) as TomlTable)['ignore']).toStrictEqual([
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['a.sh', 'b.sh'], reason },
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' },
    ]);
    const everywhere = await runGspot(folder.path, [...commandArguments, '--reason', reason]);
    expect(everywhere.code, everywhere.stdout + everywhere.stderr).toBe(0);
    expect((parse(await readFile(settingsPath, 'utf8')) as TomlTable)['ignore']).toStrictEqual([
        { check: 'bash/shellcheck', rule: 'SC2312', reason },
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' },
    ]);
    const removed = await runGspot(folder.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2312']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toContain('Removed 2 ignores for bash/shellcheck.');
    expect((parse(await readFile(settingsPath, 'utf8')) as TomlTable)['ignore']).toBeUndefined();
});

test('an ignore without paths stops a command check and its fixer until unignore', async () => {
    await using folder = await testdir();
    const command = [process.execPath, '-e', "await Bun.write('read.txt', 'executed'); process.exitCode = 1;"];
    const fix = [process.execPath, '-e', "await Bun.write('corrected.txt', 'corrected');"];
    const settings = buildSettingsText([], {
        tables: `[[command_check]]
name = "project/quality"
output = { format = "none" }
command = ${JSON.stringify(command)}
fix = ${JSON.stringify(fix)}
paths = ["entry.sh"]
stage = "commit"
`,
    });
    await createFileTree(folder.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const commandArguments = ['check', '--only', 'project/quality', '--json'];
    const before = await runGspot(folder.path, commandArguments);
    expect(before.code, before.stdout + before.stderr).toBe(1);
    expect(await readFile(join(folder.path, 'read.txt'), 'utf8')).toBe('executed');
    await unlink(join(folder.path, 'read.txt'));
    const reason = 'The sandbox preserves the command failure.';
    const ignored = await runGspot(folder.path, ['ignore', 'project/quality', '--reason', reason]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const skipped = await checkReport(folder.path, [...commandArguments, '--fix']);
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    const report = skipped.report;
    expect(report.checks[0]).toMatchObject({ check: 'project/quality', status: 'skipped', findings: [] });
    expect(report.skips).toStrictEqual([{ check: 'project/quality', cause: 'ignore' }]);
    expect(report.ignores).toStrictEqual([{ check: 'project/quality', reason, matched: 0 }]);
    expect(await isOnDisk(join(folder.path, 'read.txt'))).toBe(false);
    expect(await isOnDisk(join(folder.path, 'corrected.txt'))).toBe(false);
    const removed = await runGspot(folder.path, ['unignore', 'project/quality']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await runGspot(folder.path, commandArguments);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(await readFile(join(folder.path, 'read.txt'), 'utf8')).toBe('executed');
});

test('an ignored folder covers its subfolders, and a negated file in it is still checked', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'legacy scripts/nested/example.sh': 'if then\n',
        'legacy scripts/required.sh': 'if then\n',
        'entry.sh': 'echo example\n',
    });
    const ignored = await runGspot(folder.path, [
        'ignore',
        'project/bash-syntax',
        '--reason',
        'The legacy files retain malformed syntax.',
        '--paths',
        'legacy scripts',
        '!legacy scripts/required.sh',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const command = ['check', '--only', 'project/bash-syntax', '--json'];
    const checked = await checkReport(folder.path, command);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
    expect(new Set(report.checks[0]?.findings.map(({ file }) => file))).toStrictEqual(
        new Set(['legacy scripts/required.sh']),
    );
    expect(report.ignores[0]?.matched).toBe(0);
    await writeFile(join(folder.path, 'legacy scripts/required.sh'), 'echo corrected\n');
    const corrected = await runGspot(folder.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const removed = await runGspot(folder.path, [
        'unignore',
        'project/bash-syntax',
        '--paths',
        'legacy scripts',
        '!legacy scripts/required.sh',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await checkReport(folder.path, command);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(new Set(restored.report.checks[0]?.findings.map(({ file }) => file))).toStrictEqual(
        new Set(['legacy scripts/nested/example.sh']),
    );
});

/** Read saved ignore records with their dates serialized for the assertions. */
async function readIgnoreRecords(root: string) {
    return parseSettings(
        await readFile(join(root, 'gspot.toml'), 'utf8'),
        undefined,
        createReadCache(process.cwd()),
    ).ignore.map((entry) => ({ ...entry, until: entry.until?.toISOString() }));
}

test('ignore without a check keeps the paths out of every check and every tool file', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['bash'], { rules: true, tables: '[rules]\nenabled = false\n' }),
        'entry.sh': 'echo entry\n',
        'data/facts.txt': 'Nebulix\n',
    });
    const refused = await runGspot(folder.path, ['ignore', '--rule', 'SC2086', '--paths', 'data/**', '--reason', 'x']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('An ignore without a check cannot take --rule.');
    const reason = 'Product facts copy words as printed on the packaging.';
    const result = await runGspot(folder.path, ['ignore', '--paths', 'data/**', '--reason', reason]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('Ignored every check for data/**.');
    const saved = parse(await readFile(join(folder.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(saved['ignore']).toStrictEqual([{ paths: ['data/**'], reason }]);
    const typos = await readFile(join(folder.path, '.gspot/configurations/general/spelling/typos.toml'), 'utf8');
    expect(typos).toContain('"data/**"');
    const removed = await runGspot(folder.path, ['unignore', '--paths', 'data/**']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(parse(await readFile(join(folder.path, 'gspot.toml'), 'utf8'))).not.toHaveProperty('ignore');
});

import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { unlink, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';

import {
    TWO_IGNORE_RECORDS,
    IGNORE_HOOK_TABLES,
    PATH_IGNORE_ARGUMENTS,
    MERGED_EXPIRY_IGNORES,
    FUNCTION_NAME_IGNORES,
    DATED_IGNORE_ARGUMENTS,
    UNKNOWN_IGNORE_ARGUMENTS,
    REMAINING_EXPIRY_IGNORES,
} from '#tests/data/commands/ignore.ts';

test('ignore of an unknown check exits 2 and leaves gspot.toml byte for byte', async () => {
    await using folder = await testdir({ 'gspot.toml': TWO_IGNORE_RECORDS, 'entry.sh': 'echo example\n' });
    const result = await runGspot(folder.path, UNKNOWN_IGNORE_ARGUMENTS);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toContain('bash/shellcheck');
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe(TWO_IGNORE_RECORDS);
});

test('ignore merges paths into one entry and prints them, and unignore removes one path', async () => {
    await using folder = await testdir({
        'gspot.toml':
            '# Comment on configurations.\n' +
            buildSandboxSettings(['bash'], {
                rules: true,
                tables: BASH_SYNTAX_CHECK + IGNORE_HOOK_TABLES,
            }),
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
    });

    const first = await runGspot(folder.path, [...PATH_IGNORE_ARGUMENTS, 'a.sh']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const added = await runGspot(folder.path, [...PATH_IGNORE_ARGUMENTS, 'b.sh']);
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
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], {
            rules: true,
            tables: BASH_SYNTAX_CHECK + '[rules]\nenabled = false\n',
        }),
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
        'c.sh': 'echo c\n',
    });

    for (const [until, path] of [
        ['2099-05-20', 'a.sh'],
        ['2099-05-20', 'b.sh'],
        ['2099-05-21', 'c.sh'],
    ]) {
        const saved = await runGspot(folder.path, [...DATED_IGNORE_ARGUMENTS, '--until', until!, '--paths', path!]);
        expect(saved.code, saved.stdout + saved.stderr).toBe(0);
    }

    expect(await readIgnoreRecords(folder.path)).toStrictEqual(MERGED_EXPIRY_IGNORES);
    const removed = await runGspot(folder.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086', '--paths', 'b.sh']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(await readIgnoreRecords(folder.path)).toStrictEqual(REMAINING_EXPIRY_IGNORES);
});

test('ignore refuses an invalid --until date and leaves gspot.toml unchanged', async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
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
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
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
    const settings = buildSandboxSettings([], {
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
    const skipped = parseCheckReport(await runGspot(folder.path, [...commandArguments, '--fix']));
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    const report = skipped.report;
    expect(report.checks).toMatchObject([{ check: 'project/quality', status: 'skipped', cause: 'ignore' }]);
    expect(report.checks[0]).toMatchObject({ check: 'project/quality', status: 'skipped', findings: [] });
    expect(report.ignores).toStrictEqual([{ check: 'project/quality', reason }]);
    expect(await isOnDisk(join(folder.path, 'read.txt'))).toBe(false);
    expect(await isOnDisk(join(folder.path, 'corrected.txt'))).toBe(false);
    const removed = await runGspot(folder.path, ['unignore', 'project/quality']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await runGspot(folder.path, commandArguments);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(await readFile(join(folder.path, 'read.txt'), 'utf8')).toBe('executed');
});

test('an ignored folder covers its subfolders, and a negated file in it is still checked', async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
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
    const checked = parseCheckReport(await runGspot(folder.path, command));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
    expect(new Set(report.checks[0]?.findings.map(({ file }) => file))).toStrictEqual(
        new Set(['legacy scripts/required.sh']),
    );
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
    const restored = parseCheckReport(await runGspot(folder.path, command));
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(new Set(restored.report.checks[0]?.findings.map(({ file }) => file))).toStrictEqual(
        new Set(['legacy scripts/nested/example.sh']),
    );
});

/** Read saved ignore records with their dates serialized for the assertions. */
async function readIgnoreRecords(root: string) {
    return parseSettings(await readFile(join(root, 'gspot.toml'), 'utf8'), undefined).ignore.map((entry) => ({
        ...entry,
        until: entry.until?.toISOString(),
    }));
}

test('ignore without a check keeps the paths out of every check and every tool file', async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true, tables: '[rules]\nenabled = false\n' }),
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

test('gspot ignore escapes a route folder in its paths, and a pattern with a bare group gets the escape hint', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {}),
        'app/(legal)/terms/page.tsx': 'export default function Terms() { return null; }\n',
    });
    commitAll(sandbox.path);
    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'structure/lone-files',
        '--paths',
        'app/(legal)/**',
        '--reason',
        'Next.js route groups hold one page each.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toMatchObject([{ paths: [String.raw`app/\(legal\)/**`] }]);
    expect(await checkFindings(sandbox.path, 'gspot/unmatched-patterns')).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['typescript'], {
            tables: '[[ignore]]\ncheck = "structure/lone-files"\npaths = ["app/(missing)/**"]\nreason = "A route group."\n',
        }),
    );
    const unmatched = await checkFindings(sandbox.path, 'gspot/unmatched-patterns');
    expect(unmatched.map(({ message }) => message)).toStrictEqual([
        String.raw`app/(missing)/** under [[ignore]] matches no tracked file or folder. If a folder name holds ( ) [ ], escape each with a backslash in a TOML literal string, such as 'app/\(legal\)/**'.`,
    ]);
});

test('gspot ignore --names writes the function names of a structure/trivial-functions ignore', async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
        'main.py': '',
    });
    const result = await runGspot(folder.path, [
        'ignore',
        'structure/trivial-functions',
        '--names',
        'define_schema',
        'execute',
        '--paths',
        'nodes/**',
        '--reason',
        'The host application calls these hooks by name.',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parse(await readFile(join(folder.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toStrictEqual(FUNCTION_NAME_IGNORES);
});

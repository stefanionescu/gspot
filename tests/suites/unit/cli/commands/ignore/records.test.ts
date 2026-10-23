import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { parseSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/runs/command.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import type { TomlTable, IgnoreRecord } from '#cli/types/settings/file.ts';

import {
    IGNORE_HOOK_TABLES,
    MERGED_EXPIRY_IGNORES,
    PATH_IGNORE_ARGUMENTS,
    DATED_IGNORE_ARGUMENTS,
    REMAINING_EXPIRY_IGNORES,
    UNKNOWN_IGNORE_ARGUMENTS,
} from '#tests/config/commands/ignore.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
async function readIgnoreRecords(
    root: string,
): Promise<Array<Omit<IgnoreRecord, 'until'> & { until: string | undefined }>> {
    return parseSettings(await readFile(join(root, 'gspot.toml'), 'utf8'), undefined).ignore.map((ignore) => ({
        ...ignore,
        until: ignore.until?.toISOString(),
    }));
}

test('ignore of an unknown check exits 2 and leaves gspot.toml byte for byte', async () => {
    const settings = buildSandboxSettings(['bash']);
    await using sandbox = await testdir({ 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const result = await runGspot(sandbox.path, UNKNOWN_IGNORE_ARGUMENTS);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toBe(
        'There is no check called bash/shelcheck. Did you mean `bash/shellcheck`?\n',
    );
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('ignore merges paths into one record and prints them, and unignore removes one path', async () => {
    await using sandbox = await testdir({
        'gspot.toml':
            '# Comment on configurations.\n' +
            buildSandboxSettings(['bash'], {
                rules: true,
                tables: BASH_SYNTAX_CHECK + IGNORE_HOOK_TABLES,
            }),
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
    });

    const first = await runGspot(sandbox.path, [...PATH_IGNORE_ARGUMENTS, 'a.sh']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const added = await runGspot(sandbox.path, [...PATH_IGNORE_ARGUMENTS, 'b.sh']);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    expect(added.stdout).toStartWith(
        '[[ignore]]\ncheck = "bash/shellcheck"\npaths = [ "a.sh", "b.sh" ]\nreason = "The inputs demonstrate word splitting."\nIgnored bash/shellcheck for b.sh.\n',
    );
    const removed = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--paths', 'b.sh']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const saved = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect((parse(saved) as TomlTable)['ignore']).toStrictEqual([
        { check: 'bash/shellcheck', paths: ['a.sh'], reason: 'The inputs demonstrate word splitting.' },
    ]);
    expect(saved).toContain('# Comment on configurations.');
    expect(saved).toContain('# Keep the push selection.');
    expect(saved.indexOf('[hooks]')).toBeLessThan(saved.indexOf('[[ignore]]'));
});

test('ignore merges records with the same --until date, keeps other dates apart, and unignore removes one path', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], {
            rules: true,
            tables: BASH_SYNTAX_CHECK,
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
        const saved = await runGspot(sandbox.path, [...DATED_IGNORE_ARGUMENTS, '--until', until!, '--paths', path!]);
        expect(saved.code, saved.stdout + saved.stderr).toBe(0);
    }

    expect(await readIgnoreRecords(sandbox.path)).toStrictEqual(MERGED_EXPIRY_IGNORES);
    const removed = await runGspot(sandbox.path, [
        'unignore',
        'bash/shellcheck',
        '--rule',
        'SC2086',
        '--paths',
        'b.sh',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(await readIgnoreRecords(sandbox.path)).toStrictEqual(REMAINING_EXPIRY_IGNORES);
});

test('ignore refuses an invalid --until date and leaves gspot.toml unchanged', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'example.sh': 'echo ready\n',
    });

    const before = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    const invalid = await runGspot(sandbox.path, [
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
        message: '--until needs a calendar date in YYYY-MM-DD form, such as 2027-01-31.',
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(before);
});

test('ignore merges matching paths, keeps different reasons apart, and an entry without paths covers the scope', async () => {
    await using sandbox = await testdir({
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
        const result = await runGspot(sandbox.path, [
            ...commandArguments,
            '--reason',
            explanation,
            '--paths',
            ...paths,
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const settingsPath = join(sandbox.path, 'gspot.toml');
    expect((parse(await readFile(settingsPath, 'utf8')) as TomlTable)['ignore']).toStrictEqual([
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['a.sh', 'b.sh'], reason },
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' },
    ]);
    const everywhere = await runGspot(sandbox.path, [...commandArguments, '--reason', reason]);
    expect(everywhere.code, everywhere.stdout + everywhere.stderr).toBe(0);
    expect((parse(await readFile(settingsPath, 'utf8')) as TomlTable)['ignore']).toStrictEqual([
        { check: 'bash/shellcheck', rule: 'SC2312', reason },
        { check: 'bash/shellcheck', rule: 'SC2312', paths: ['other.sh'], reason: 'Another cause.' },
    ]);
    const removed = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2312']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toStartWith('Removed 2 ignores for bash/shellcheck.\n');
    expect(parse(await readFile(settingsPath, 'utf8'))).not.toHaveProperty('ignore');
});

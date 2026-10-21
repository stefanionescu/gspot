import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { SHELLCHECK_IGNORE } from '#tests/data/commands/ignore.ts';
import { parse, stringify, LocalDate } from '@decimalturn/toml-patch';

test('unignore removes a matching ignore, and a second run reports no change', async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true, tables: SHELLCHECK_IGNORE }),
    });
    const commandArguments = ['unignore', 'bash/shellcheck', '--rule', 'SC2086'];
    const removed = await runGspot(folder.path, commandArguments);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toStartWith('Removed 1 ignore for bash/shellcheck.\n');
    const saved = await readFile(join(folder.path, 'gspot.toml'), 'utf8');
    expect((parse(saved) as TomlTable)['ignore']).toBeUndefined();
    const repeated = await runGspot(folder.path, commandArguments);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(repeated.stdout).toBe('No change: bash/shellcheck has no matching ignore.\n');
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe(saved);
});

test('unignore keeps an empty ignore list and reports no change', async () => {
    const settings = buildSandboxSettings(['bash'], { rules: true, tables: 'ignore = []\n' });
    await using folder = await testdir({ 'gspot.toml': settings });
    const removed = await runGspot(folder.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toBe('No change: bash/shellcheck has no matching ignore.\n');
    expect((parse(await readFile(join(folder.path, 'gspot.toml'), 'utf8')) as TomlTable)['ignore']).toStrictEqual([]);
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('ignore removal refuses invalid settings before it changes an authored ignore', async () => {
    await using folder = await testdir();
    const settings = buildSandboxSettings(['bash'], {
        tables: `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
`,
    });
    await createFileTree(folder.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const unmatched = await runGspot(folder.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2034']);
    expect(unmatched.code, unmatched.stdout + unmatched.stderr).toBe(2);
    expect(unmatched.stderr).toContain('ignore.0.reason');
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe(settings);
    const matched = await runGspot(folder.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086']);
    expect(matched.code, matched.stdout + matched.stderr).toBe(2);
    expect(matched.stderr).toContain('ignore.0.reason');
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe(settings);
    expect(await readFile(join(folder.path, 'entry.sh'), 'utf8')).toBe('echo example\n');
});

test('unignore counts changed entries and keeps other paths and other rules', async () => {
    await using folder = await testdir();
    const selected = { check: 'bash/shellcheck', rule: 'SC2086' };
    const first = { ...selected, reason: 'Keep word splitting.', paths: ['a.sh', 'b.sh'] };
    const second = {
        ...selected,
        reason: 'Keep the expansion.',
        until: new LocalDate('2099-05-20'),
        paths: ['b.sh', 'c.sh'],
    };
    const global = { ...selected, reason: 'Keep scope-wide expansion.' };
    const other = { check: 'bash/shellcheck', rule: 'SC2034', reason: 'Read by sourcing.', paths: ['b.sh'] };
    const globalOther = {
        check: other.check,
        rule: other.rule,
        reason: 'The variables are read by sourcing scripts.',
    };
    const settings = buildSandboxSettings(['bash'], {
        tables: stringify({ ignore: [first, second, global, other, globalOther] }),
    });
    await createFileTree(folder.path, {
        'gspot.toml': settings,
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
        'c.sh': 'echo c\n',
    });
    const commandArguments = ['unignore', 'bash/shellcheck', '--rule', 'SC2086'];
    const partial = await runGspot(folder.path, [...commandArguments, '--paths', 'b.sh', 'missing.sh']);
    expect(partial.code, partial.stdout + partial.stderr).toBe(0);
    expect(partial.stdout).toStartWith('Removed 2 paths from 2 ignores.\n');
    expect(partial.stdout).toContain(
        'Kept 1 ignore that covers every path. To delete it, run gspot unignore without --paths.',
    );
    const remaining = [globalOther, other, global, { ...first, paths: ['a.sh'] }, { ...second, paths: ['c.sh'] }];
    expect((parse(await readFile(join(folder.path, 'gspot.toml'), 'utf8')) as TomlTable)['ignore']).toStrictEqual(
        remaining,
    );
    const whole = await runGspot(folder.path, commandArguments);
    expect(whole.code, whole.stdout + whole.stderr).toBe(0);
    expect(whole.stdout).toStartWith('Removed 3 ignores for bash/shellcheck.\n');
    expect((parse(await readFile(join(folder.path, 'gspot.toml'), 'utf8')) as TomlTable)['ignore']).toStrictEqual([
        globalOther,
        other,
    ]);
    expect(await readFile(join(folder.path, 'a.sh'), 'utf8')).toBe('echo a\n');
    expect(await readFile(join(folder.path, 'b.sh'), 'utf8')).toBe('echo b\n');
    expect(await readFile(join(folder.path, 'c.sh'), 'utf8')).toBe('echo c\n');
});

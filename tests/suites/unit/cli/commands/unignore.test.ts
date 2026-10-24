import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/cli/commands.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { parse, LocalDate, stringify } from '@decimalturn/toml-patch';
import { SHELLCHECK_IGNORE, SHELLCHECK_RULE_IGNORE } from '#tests/config/commands/unignore.ts';

test('unignore removes a matching ignore, and a second run reports no change', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true, tables: SHELLCHECK_IGNORE }),
    });
    const commandArguments = ['unignore', 'bash/shellcheck', '--rule', 'SC2086'];
    const removed = await runGspot(sandbox.path, commandArguments);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout.split('\n').filter((line) => !line.startsWith('wrote '))).toStrictEqual([
        'Removed 1 ignore for bash/shellcheck.',
        'updated  AGENTS.md',
        'note     The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.',
        '',
    ]);
    const saved = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect((parse(saved) as TomlTable)['ignore']).toBeUndefined();
    const repeated = await runGspot(sandbox.path, commandArguments);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(repeated.stdout).toBe('No change: bash/shellcheck has no matching ignore.\n');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(saved);
});

test('unignore keeps an empty ignore list and reports no change', async () => {
    const settings = buildSandboxSettings(['bash'], { rules: true, tables: 'ignore = []\n' });
    await using sandbox = await testdir({ 'gspot.toml': settings });
    const removed = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toBe('No change: bash/shellcheck has no matching ignore.\n');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('unignore refuses a gspot.toml whose ignore has no reason and writes nothing', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['bash'], SHELLCHECK_RULE_IGNORE);
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const unmatched = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2034']);
    expect(unmatched.code, unmatched.stdout + unmatched.stderr).toBe(2);
    expect(unmatched.stderr).toBe(
        'gspot.toml: ignore.0.reason: needs a reason. Add `reason = "..."` to this record.\n',
    );
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    const matched = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086']);
    expect(matched.code, matched.stdout + matched.stderr).toBe(2);
    expect(matched.stderr).toBe('gspot.toml: ignore.0.reason: needs a reason. Add `reason = "..."` to this record.\n');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('unignore counts the changed ignores and keeps other paths and other rules', async () => {
    await using sandbox = await testdir();
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
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
        'c.sh': 'echo c\n',
    });
    const commandArguments = ['unignore', 'bash/shellcheck', '--rule', 'SC2086'];
    const partial = await runGspot(sandbox.path, [...commandArguments, '--paths', 'b.sh', 'missing.sh']);
    expect(partial.code, partial.stdout + partial.stderr).toBe(0);
    expect(partial.stdout.split('\n').filter((line) => !line.startsWith('wrote '))).toStrictEqual([
        'Removed 2 paths from 2 ignores.',
        'note     The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.',
        'Kept 1 ignore that covers every path. To delete it, run gspot unignore without --paths.',
        '',
    ]);
    const remaining = [globalOther, other, global, { ...first, paths: ['a.sh'] }, { ...second, paths: ['c.sh'] }];
    expect((parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['ignore']).toStrictEqual(
        remaining,
    );
    const result = await runGspot(sandbox.path, commandArguments);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n').filter((line) => !line.startsWith('wrote '))).toStrictEqual([
        'Removed 3 ignores for bash/shellcheck.',
        'note     The tool lockfile is missing or stale. Run gspot install; until then gspot/generated-files fails on it.',
        '',
    ]);
    expect((parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['ignore']).toStrictEqual([
        globalOther,
        other,
    ]);
});

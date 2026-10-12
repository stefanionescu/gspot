import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseExpiryDate } from '#cli/settings/file.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { UNIGNORE_CASES } from '#tests/config/ignore.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';

test.each([...UNIGNORE_CASES])(
    'unignore from %s prints its summary and reports a repeat as unchanged',
    async (_, tables, summary) => {
        await using directory = await testdir();
        const settings = settingsText(['bash'], { rules: true, tables });
        await createFileTree(directory.path, {
            'gspot.toml': settings,
            'entry.sh': 'echo example\n',
            'control.txt': 'keep this file\n',
        });
        const argv = ['unignore', 'bash/shellcheck', '--rule', 'SC2086'];
        const removed = await runGspot(directory.path, argv);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(removed.stdout).toStartWith(`${summary}\n`);
        const saved = await readFile(join(directory.path, 'gspot.toml'), 'utf8');
        expect(parse(saved)['ignore']).toStrictEqual(tables === 'ignore = []\n' ? [] : undefined);
        const repeated = await runGspot(directory.path, argv);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect(repeated.stdout).toBe('nothing to remove\n');
        expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(saved);
        expect(await readFile(join(directory.path, 'entry.sh'), 'utf8')).toBe('echo example\n');
        expect(await readFile(join(directory.path, 'control.txt'), 'utf8')).toBe('keep this file\n');
    },
);

test('unignore keeps its summary and the apply failure, and leaves an edited generated file alone', async () => {
    await using directory = await testdir();
    const settings = settingsText(['bash'], {
        tables: `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
reason = "The sample keeps word splitting."
`,
    });
    await createFileTree(directory.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const config = join(directory.path, '.gspot/config/shellcheckrc');
    const edited = `${await readFile(config, 'utf8')}# Preserve this authored edit.\n`;
    await chmod(config, 0o644);
    await writeFile(config, edited);
    const removed = await runGspot(directory.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(2);
    expect(removed.stdout).toBe('');
    expect(removed.stderr).toContain('deleted 1 ignore');
    expect(removed.stderr).toContain('gspot.toml keeps this change, and applying it stopped:');
    expect(removed.stderr).toContain('These files were not overwritten by gspot: .gspot/config/shellcheckrc.');
    expect(removed.stderr).toContain('Fix that, then run gspot apply.\n');
    expect(parse(await readFile(join(directory.path, 'gspot.toml'), 'utf8'))['ignore']).toBeUndefined();
    expect(await readFile(config, 'utf8')).toBe(edited);
    expect(await readFile(join(directory.path, 'entry.sh'), 'utf8')).toBe('echo example\n');
});

test('ignore removal validates unchanged settings and can repair an invalid authored ignore', async () => {
    await using directory = await testdir();
    const settings = settingsText(['bash'], {
        tables: `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
`,
    });
    await createFileTree(directory.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const unmatched = await runGspot(directory.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2034']);
    expect(unmatched.code, unmatched.stdout + unmatched.stderr).toBe(2);
    expect(unmatched.stderr).toContain('ignore.0.reason');
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(settings);
    const repaired = await runGspot(directory.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086']);
    expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
    expect(repaired.stdout).toStartWith('deleted 1 ignore\n');
    expect(parse(await readFile(join(directory.path, 'gspot.toml'), 'utf8'))['ignore']).toBeUndefined();
    expect(await readFile(join(directory.path, 'entry.sh'), 'utf8')).toBe('echo example\n');
});

test('unignore counts changed entries and keeps other paths and other rules', async () => {
    await using directory = await testdir();
    const selected = { check: 'bash/shellcheck', rule: 'SC2086' };
    const first = { ...selected, reason: 'Keep word splitting.', paths: ['a.sh', 'b.sh'] };
    const second = {
        ...selected,
        reason: 'Keep the expansion.',
        until: parseExpiryDate('2099-05-20'),
        paths: ['b.sh', 'c.sh'],
    };
    const global = { ...selected, reason: 'Keep scope-wide expansion.' };
    const other = { check: 'bash/shellcheck', rule: 'SC2034', reason: 'Read by sourcing.', paths: ['b.sh'] };
    const globalOther = {
        check: other.check,
        rule: other.rule,
        reason: 'The variables are read by sourcing scripts.',
    };
    const settings = settingsText(['bash'], {
        tables: stringify({ ignore: [first, second, global, other, globalOther] }),
    });
    await createFileTree(directory.path, {
        'gspot.toml': settings,
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
        'c.sh': 'echo c\n',
    });
    const argv = ['unignore', 'bash/shellcheck', '--rule', 'SC2086'];
    const partial = await runGspot(directory.path, [...argv, '--paths', 'b.sh', 'missing.sh']);
    expect(partial.code, partial.stdout + partial.stderr).toBe(0);
    expect(partial.stdout).toStartWith('took 2 paths out of 2 ignores\n');
    expect(partial.stdout).toContain(
        'Kept 1 ignore that covers every path. To delete it, run gspot unignore without --paths.',
    );
    const remaining = [globalOther, other, global, { ...first, paths: ['a.sh'] }, { ...second, paths: ['c.sh'] }];
    expect(parse(await readFile(join(directory.path, 'gspot.toml'), 'utf8'))['ignore']).toStrictEqual(remaining);
    const whole = await runGspot(directory.path, argv);
    expect(whole.code, whole.stdout + whole.stderr).toBe(0);
    expect(whole.stdout).toStartWith('deleted 3 ignores\n');
    expect(parse(await readFile(join(directory.path, 'gspot.toml'), 'utf8'))['ignore']).toStrictEqual([
        globalOther,
        other,
    ]);
    expect(await readFile(join(directory.path, 'a.sh'), 'utf8')).toBe('echo a\n');
    expect(await readFile(join(directory.path, 'b.sh'), 'utf8')).toBe('echo b\n');
    expect(await readFile(join(directory.path, 'c.sh'), 'utf8')).toBe('echo c\n');
});

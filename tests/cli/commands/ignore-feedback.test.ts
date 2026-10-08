import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { parseExpiryDate } from '#cli/policy/document/public.ts';
import { IGNORE_FEEDBACK_CASES } from '#tests/config/cli/commands/ignores.ts';

test.each(IGNORE_FEEDBACK_CASES)(
    'ignore removal from %s keeps apply notes and reports an unchanged repeat',
    async (_, tables, summary) => {
        await using directory = await testdir();
        const policy = buildPolicy(['bash'], {
            tables,
        });
        const authored = '# Authored instructions\n\nKeep the source file.\n';
        await createFileTree(directory.path, {
            'gspot.toml': policy,
            'CLAUDE.md': authored,
            'entry.sh': 'echo example\n',
            'control.txt': 'keep this file\n',
        });
        const argv = ['ignore', 'bash/shellcheck', '--rule', 'SC2086', '--remove'];
        const removed = await runGspot(directory.path, argv);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(removed.stdout).toStartWith(`${summary}\n`);
        expect(removed.stdout).toContain('note     CLAUDE.md text moves to the end of AGENTS.md\n');
        expect(await readFile(join(directory.path, 'AGENTS.md'), 'utf8')).toEndWith(authored);
        expect(await pathExists(join(directory.path, 'CLAUDE.md'))).toBe(false);
        const saved = await readFile(join(directory.path, 'gspot.toml'), 'utf8');
        expect(parse(saved)['ignore']).toBeUndefined();
        const agents = await readFile(join(directory.path, 'AGENTS.md'), 'utf8');
        const repeated = await runGspot(directory.path, argv);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect(repeated.stdout).toBe('nothing to remove: no matching ignore entry\n');
        expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(saved);
        expect(await readFile(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(agents);
        expect(await readFile(join(directory.path, 'entry.sh'), 'utf8')).toBe('echo example\n');
        expect(await readFile(join(directory.path, 'control.txt'), 'utf8')).toBe('keep this file\n');
    },
);

test('ignore removal keeps its summary and apply failure while preserving edited output', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['bash'], {
        tables: '[agent_rules]\nenabled = false\n[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\nreason = "The fixture keeps word splitting."\n',
    });
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const config = join(directory.path, '.gspot/config/shellcheckrc');
    const edited = `${await readFile(config, 'utf8')}# Preserve this authored edit.\n`;
    await chmod(config, 0o644);
    await writeFile(config, edited);
    const removed = await runGspot(directory.path, ['ignore', 'bash/shellcheck', '--rule', 'SC2086', '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(2);
    expect(removed.stdout).toStartWith('removed 1 ignore entry for bash/shellcheck\n');
    expect(removed.stdout).toContain('gspot.toml keeps this change, and applying it stopped:');
    expect(removed.stdout).toContain('These edited files were not overwritten by gspot: .gspot/config/shellcheckrc.');
    expect(removed.stdout).toContain('Resolve that, then run gspot apply.\n');
    expect(parse(await readFile(join(directory.path, 'gspot.toml'), 'utf8'))['ignore']).toBeUndefined();
    expect(await readFile(config, 'utf8')).toBe(edited);
    expect(await readFile(join(directory.path, 'entry.sh'), 'utf8')).toBe('echo example\n');
});

test('ignore removal validates unchanged policy and can repair an invalid authored ignore', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['bash'], {
        tables: '[agent_rules]\nenabled = false\n[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\n',
    });
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const unmatched = await runGspot(directory.path, ['ignore', 'bash/shellcheck', '--rule', 'SC2034', '--remove']);
    expect(unmatched.code, unmatched.stdout + unmatched.stderr).toBe(2);
    expect(unmatched.stderr).toContain('ignore.0.reason');
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    const repaired = await runGspot(directory.path, ['ignore', 'bash/shellcheck', '--rule', 'SC2086', '--remove']);
    expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
    expect(repaired.stdout).toStartWith('removed 1 ignore entry for bash/shellcheck\n');
    expect(parse(await readFile(join(directory.path, 'gspot.toml'), 'utf8'))['ignore']).toBeUndefined();
    expect(await readFile(join(directory.path, 'entry.sh'), 'utf8')).toBe('echo example\n');
});

test('ignore removal counts changed entries and keeps partial paths and other selectors', async () => {
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
    const policy = buildPolicy(['bash'], {
        tables: '[agent_rules]\nenabled = false\n' + stringify({ ignore: [first, second, global, other] }),
    });
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
        'c.sh': 'echo c\n',
    });
    const argv = ['ignore', 'bash/shellcheck', '--rule', 'SC2086', '--remove'];
    const partial = await runGspot(directory.path, [...argv, '--paths', 'b.sh', 'missing.sh']);
    expect(partial.code, partial.stdout + partial.stderr).toBe(0);
    expect(partial.stdout).toStartWith('removed 2 ignore entries for bash/shellcheck\n');
    const remaining = [other, global, { ...first, paths: ['a.sh'] }, { ...second, paths: ['c.sh'] }];
    expect(parse(await readFile(join(directory.path, 'gspot.toml'), 'utf8'))['ignore']).toStrictEqual(remaining);
    const whole = await runGspot(directory.path, argv);
    expect(whole.code, whole.stdout + whole.stderr).toBe(0);
    expect(whole.stdout).toStartWith('removed 1 ignore entry for bash/shellcheck\n');
    expect(parse(await readFile(join(directory.path, 'gspot.toml'), 'utf8'))['ignore']).toStrictEqual([
        other,
        { ...first, paths: ['a.sh'] },
        { ...second, paths: ['c.sh'] },
    ]);
    expect(await readFile(join(directory.path, 'a.sh'), 'utf8')).toBe('echo a\n');
    expect(await readFile(join(directory.path, 'b.sh'), 'utf8')).toBe('echo b\n');
    expect(await readFile(join(directory.path, 'c.sh'), 'utf8')).toBe('echo c\n');
});

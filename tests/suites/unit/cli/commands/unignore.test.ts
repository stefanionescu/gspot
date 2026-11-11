import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse, stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import type { TomlTable } from '#cli/types/settings.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('unignore of a rule with no matching ignore reports no change', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const result = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        changed: false,
        summary: 'No change: rule SC2086 of bash/shellcheck has no matching ignore.',
    });
});

test('unignore --paths counts the paths it removes and the ignores it narrows, and keeps other rules', async () => {
    const selected = { check: 'bash/shellcheck', rule: 'SC2086' };
    const first = { ...selected, reason: 'Keep word splitting.', paths: ['a.sh', 'b.sh'] };
    const second = { ...selected, reason: 'Keep the expansion.', paths: ['b.sh', 'c.sh'] };
    const other = { check: 'bash/shellcheck', rule: 'SC2034', reason: 'Read by sourcing.', paths: ['b.sh'] };
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: stringify({ ignore: [first, second, other] }) }),
        'a.sh': 'echo a\n',
        'b.sh': 'echo b\n',
        'c.sh': 'echo c\n',
    });
    const result = await runGspot(sandbox.path, [
        'unignore',
        'bash/shellcheck',
        '--rule',
        'SC2086',
        '--paths',
        'b.sh',
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        summary: 'Removed 2 paths from 2 ignores of rule SC2086 of bash/shellcheck for b.sh.',
    });
    const contents = (parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['ignore'];
    expect(contents).toStrictEqual([{ ...first, paths: ['a.sh'] }, { ...second, paths: ['c.sh'] }, other]);
});

test('unignore --paths names the rule of an ignore that covers every path, and the printed command removes it', async () => {
    const everywhere = { check: 'bash/shellcheck', rule: 'SC2086', reason: 'Word splitting is intentional here.' };
    const narrow = { check: 'bash/shellcheck', rule: 'SC2034', paths: ['a.sh'], reason: 'Read by sourcing scripts.' };
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: stringify({ ignore: [everywhere, narrow] }) }),
        'a.sh': 'echo a\n',
    });
    const narrowed = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--paths', 'a.sh', '--json']);
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(0);
    expect(JSON.parse(narrowed.stdout)).toMatchObject({
        summary: 'Removed 1 ignore of bash/shellcheck for a.sh.',
        notes: expect.arrayContaining([
            'The ignore of rule SC2086 of bash/shellcheck covers every path, so --paths removes nothing from it. Run gspot unignore bash/shellcheck --rule SC2086 to remove it.',
        ]) as string[],
    });
    const unchanged = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--paths', 'a.sh', '--json']);
    expect(JSON.parse(unchanged.stdout)).toMatchObject({
        changed: false,
        summary:
            'No change. The ignore of rule SC2086 of bash/shellcheck covers every path, so --paths removes nothing from it. Run gspot unignore bash/shellcheck --rule SC2086 to remove it.',
    });
    const removed = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const settings = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(settings['ignore']).toBeUndefined();
});

test('unignore --paths on an ignore of a whole check names no rule', async () => {
    const everywhere = { check: 'bash/shellcheck', reason: 'The scripts are generated.' };
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: stringify({ ignore: [everywhere] }) }),
        'a.sh': 'echo a\n',
    });
    const result = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--paths', 'a.sh', '--json']);
    expect(JSON.parse(result.stdout)).toMatchObject({
        changed: false,
        summary:
            'No change. The ignore of bash/shellcheck covers every path, so --paths removes nothing from it. Run gspot unignore bash/shellcheck to remove it.',
    });
});

test('unignore --paths from a subfolder removes only the repository-relative path', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], {
            tables: stringify({
                ignore: [
                    {
                        check: 'bash/shellcheck',
                        rule: 'SC2086',
                        paths: ['app/entry.sh', 'entry.sh'],
                        reason: 'The scripts deliberately split words.',
                    },
                ],
            }),
        }),
        'entry.sh': 'echo root\n',
        'app/entry.sh': 'echo app\n',
    });
    const result = await runGspot(join(sandbox.path, 'app'), [
        'unignore',
        'bash/shellcheck',
        '--rule',
        'SC2086',
        '--paths',
        'entry.sh',
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
        changed: true,
    });
    const settings = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(settings['ignore']).toStrictEqual([
        {
            check: 'bash/shellcheck',
            rule: 'SC2086',
            paths: ['entry.sh'],
            reason: 'The scripts deliberately split words.',
        },
    ]);
});

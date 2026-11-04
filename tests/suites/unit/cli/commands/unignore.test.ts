import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile } from 'node:fs/promises';
import type { TomlTable } from '#cli/types/settings.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('unignore removes a matching ignore, and a second run reports no change', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], {
            rules: true,
            tables: `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
reason = "Word splitting is intentional in this sandbox."
`,
        }),
    });
    const commandArguments = ['unignore', 'bash/shellcheck', '--rule', 'SC2086'];
    const removed = await runGspot(sandbox.path, commandArguments);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const saved = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect((parse(saved) as TomlTable)['ignore']).toBeUndefined();
    const repeated = await runGspot(sandbox.path, commandArguments);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(saved);
});

test('unignore counts the changed ignores and keeps other paths and other rules', async () => {
    await using sandbox = await createGitSandbox({});
    const selected = { check: 'bash/shellcheck', rule: 'SC2086' };
    const first = { ...selected, reason: 'Keep word splitting.', paths: ['a.sh', 'b.sh'] };
    const second = { ...selected, reason: 'Keep the expansion.', paths: ['b.sh', 'c.sh'] };
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
    const partial = await runGspot(sandbox.path, [...commandArguments, '--paths', 'b.sh', '--json']);
    expect(partial.code, partial.stdout + partial.stderr).toBe(0);
    expect(JSON.parse(partial.stdout)).toMatchObject({
        changed: true,
        notes: expect.arrayContaining([expect.stringContaining('bash/shellcheck')]) as string[],
    });
    const remaining = [{ ...first, paths: ['a.sh'] }, { ...second, paths: ['c.sh'] }, global, other, globalOther];
    const contents = (parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['ignore'];
    expect(contents).toStrictEqual(remaining);
    const result = await runGspot(sandbox.path, commandArguments);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const ignores = (parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['ignore'];
    expect(ignores).toStrictEqual([other, globalOther]);
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

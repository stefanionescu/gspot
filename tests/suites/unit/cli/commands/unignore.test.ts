import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { STALE_LOCKFILE_NOTE } from '#tests/config/messages.ts';
import { UPDATED_AGENTS } from '#tests/config/commands/contents.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { parse, LocalDate, stringify } from '@decimalturn/toml-patch';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    TOOLS_CHANGED_LINE,
    UPDATED_GITATTRIBUTES,
    SHELLCHECK_RULE_IGNORE,
    UNMATCHED_RULE_MESSAGE,
} from '#tests/config/commands/unignore.ts';

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
    expect(removed.stdout.split('\n').filter((line) => !line.startsWith('wrote '))).toStrictEqual([
        'Removed 1 ignore for rule SC2086 of bash/shellcheck.',

        UPDATED_GITATTRIBUTES,
        UPDATED_AGENTS,
        TOOLS_CHANGED_LINE,
        '',
    ]);
    const saved = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect((parse(saved) as TomlTable)['ignore']).toBeUndefined();
    const repeated = await runGspot(sandbox.path, commandArguments);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect(repeated.stdout).toBe(UNMATCHED_RULE_MESSAGE);
    const json = await runGspot(sandbox.path, [...commandArguments, '--json']);
    expect(JSON.parse(json.stdout)).toStrictEqual({ changed: false, summary: UNMATCHED_RULE_MESSAGE.trimEnd() });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(saved);
});

test('unignore keeps an empty ignore list and reports no change', async () => {
    const settings = buildSandboxSettings(['bash'], { rules: true, tables: 'ignore = []\n' });
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings });
    const removed = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2086']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toBe(UNMATCHED_RULE_MESSAGE);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('unignore refuses a gspot.toml whose ignore has no reason and writes nothing', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['bash'], SHELLCHECK_RULE_IGNORE);
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const unmatched = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--rule', 'SC2034']);
    expect(unmatched.code, unmatched.stdout + unmatched.stderr).toBe(2);
    expect(unmatched.stderr).toBe(
        'gspot.toml:3: ignore.0.reason: needs a reason. Add reason = "..." to this record.\n',
    );
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('unignore counts the changed ignores and keeps other paths and other rules', async () => {
    await using sandbox = await createGitSandbox({});
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
        'Removed 2 paths from 2 ignores for rule SC2086 of bash/shellcheck for b.sh and missing.sh.',
        'No change: the ignore of bash/shellcheck covers every path, so --paths removes nothing. Run gspot unignore bash/shellcheck to delete it.',

        UPDATED_GITATTRIBUTES,
        TOOLS_CHANGED_LINE,
        '',
    ]);
    const remaining = [{ ...first, paths: ['a.sh'] }, { ...second, paths: ['c.sh'] }, global, other, globalOther];
    const contents = (parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['ignore'];
    expect(contents).toStrictEqual(remaining);
    const result = await runGspot(sandbox.path, commandArguments);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.split('\n').filter((line) => !line.startsWith('wrote '))).toStrictEqual([
        'Removed 3 ignores for rule SC2086 of bash/shellcheck.',
        STALE_LOCKFILE_NOTE,
        '',
    ]);
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
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code).toBe(0);
    const generated = (JSON.parse(applied.stdout) as { written: string[] }).written;
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
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toStrictEqual({
        written: [],
        unchanged: generated,
        removed: [],
        updated: [],
        notes: [
            'The tool lockfile is missing or stale. Run gspot install; until then gspot/generated-files fails on it.',
        ],
        summary: 'Removed 1 path from 1 ignore for rule SC2086 of bash/shellcheck for entry.sh.',
        changed: true,
    });
    expect((parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable)['ignore']).toStrictEqual([
        {
            check: 'bash/shellcheck',
            rule: 'SC2086',
            paths: ['entry.sh'],
            reason: 'The scripts deliberately split words.',
        },
    ]);
});

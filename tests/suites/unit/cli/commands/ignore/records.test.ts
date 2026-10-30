import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { REFUSAL_FILES } from '#tests/config/commands/set.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';

import {
    IGNORE_REFUSALS,
    IGNORE_HOOK_TABLES,
    PATH_IGNORE_ARGUMENTS,
    UNKNOWN_IGNORE_ARGUMENTS,
} from '#tests/config/commands/ignore.ts';

test('ignore of an unknown check exits 2 and leaves gspot.toml byte for byte', async () => {
    const settings = buildSandboxSettings(['bash']);
    await using sandbox = await createGitSandbox({ 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const result = await runGspot(sandbox.path, UNKNOWN_IGNORE_ARGUMENTS);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toBe(
        'There is no check called bash/shelcheck. Did you mean bash/shellcheck?\n',
    );
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
});

test('ignore merges paths into one record and prints them, and unignore removes one path', async () => {
    await using sandbox = await createGitSandbox({
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
    expect(added.stdout).toBe(
        'Ignored bash/shellcheck for b.sh.\nnote     The tool lockfile is missing or stale. Run gspot install; until then gspot/generated-files fails on it.\n',
    );
    const removed = await runGspot(sandbox.path, ['unignore', 'bash/shellcheck', '--paths', 'b.sh']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toBe(
        'Removed 1 path from 1 ignore for bash/shellcheck for b.sh.\nnote     The tool lockfile is missing or stale. Run gspot install; until then gspot/generated-files fails on it.\n',
    );
    const saved = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(saved).toBe(
        '# Comment on configurations.\nconfigurations = ["bash"]\n[[command_check]]\nid = "project/bash-syntax"\ncommand = ["bash", "-n", "{file}"]\npaths = ["**/*.sh"]\nstage = "commit"\noutput = { format = "regex", pattern = "^.*: line (?<line>\\\\d+): (?<message>.*)$" }\n[rules]\nenabled = false\n[hooks]\n# Keep the push selection.\nenabled = false\n\n[[ignore]]\ncheck = "bash/shellcheck"\npaths = ["a.sh"]\nreason = "The inputs demonstrate word splitting."\n',
    );
});

test('ignore merges matching paths, keeps different reasons apart, and a record without paths covers the scope', async () => {
    await using sandbox = await createGitSandbox({
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
    expect(removed.stdout).toBe(
        'Removed 2 ignores for rule SC2312 of bash/shellcheck.\nwrote    1 generated file in .gspot/\nnote     The tool lockfile is missing or stale. Run gspot install; until then gspot/generated-files fails on it.\n',
    );
    expect(parse(await readFile(settingsPath, 'utf8'))).not.toHaveProperty('ignore');
});

test('a rule ignore summary names the rule and its paths', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });
    const result = await runGspot(sandbox.path, [
        'ignore',
        'bash/shellcheck',
        '--rule',
        'SC2086',
        '--paths',
        'entry.sh',
        '--reason',
        'The generated shell preserves splitting.',
    ]);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain('Ignored rule SC2086 of bash/shellcheck for entry.sh.');
});

test.each([...IGNORE_REFUSALS])(
    'ignore refuses $name without writing',
    async ({ arguments: commandArguments, message }) => {
        await using sandbox = await createGitSandbox(REFUSAL_FILES);
        await assertRefusalWithoutWrites(sandbox.path, commandArguments, { error: 'arguments', message });
    },
);

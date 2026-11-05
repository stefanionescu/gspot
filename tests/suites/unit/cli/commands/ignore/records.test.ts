import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import type { TomlTable } from '#cli/types/settings.ts';
import { REFUSAL_FILES, UNKNOWN_IGNORE_ARGUMENTS } from '#tests/config/commands/edits.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { assertRefusalWithoutWrites, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
            ...paths.flatMap((path) => ['--paths', path]),
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
});

test('ignore gives a weakening its reason through a rule, and refuses the whole check', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const reason = ['--reason', 'The team moves to level all after the release.'];
    const named = await runGspot(sandbox.path, ['ignore', 'gspot/weakenings', '--rule', 'level', ...reason]);
    expect(named.code, named.stdout + named.stderr).toBe(0);
    const refused = await runGspot(sandbox.path, ['ignore', 'gspot/weakenings', ...reason, '--json']);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'arguments' });
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toMatchObject([{ check: 'gspot/weakenings', rule: 'level' }]);
});

test('ignore rejects unknown rules and checks without rule output before writing settings', async () => {
    const settings = buildSandboxSettings(['javascript', 'bash']);
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'source.js': 'export const count = 1;\n',
        '.gspot/node_modules/eslint/package.json': '{"exports":{"./use-at-your-own-risk":"./rules.cjs"}}',
        '.gspot/node_modules/eslint/rules.cjs': 'exports.builtinRules = new Map();',
    });
    for (const [check, rule] of [
        ['javascript/eslint', 'no-consolee'],
        ['bash/shfmt', 'indent'],
    ] as const) {
        const result = await runGspot(sandbox.path, [
            'ignore',
            check,
            '--rule',
            rule,
            '--reason',
            'The generated source needs this exception.',
            '--json',
        ]);
        expect(result.code).toBe(2);
        expect(JSON.parse(result.stdout)).toMatchObject({
            error: 'arguments',
            message: expect.stringContaining(check) as string,
        });
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    }
});

test('ignore keeps a rule of a check without a rule catalog as given', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'source.ts': 'export const count = 1;\n',
    });
    const reason = ['--reason', 'The fixture holds a deliberate type error.'];
    const ignored = await runGspot(sandbox.path, ['ignore', 'typescript/tsc', '--rule', 'TS2322', ...reason]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toMatchObject([{ check: 'typescript/tsc', rule: 'TS2322' }]);
});

test('ignore refuses a one-letter reason without writing', async () => {
    await using sandbox = await createGitSandbox(REFUSAL_FILES);
    await assertRefusalWithoutWrites(sandbox.path, ['ignore', '--paths', 'vendor/**', '--reason', 'x'], 'arguments');
});

test('a bare unignore exits 2, names --paths, and keeps every ignore', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: '[[ignore]]\npaths = ["data/**"]\nreason = "Product facts copy the packaging."\n',
        }),
        'data/facts.txt': 'facts\n',
    });
    const refusal = await assertRefusalWithoutWrites(sandbox.path, ['unignore'], 'arguments');
    expect(refusal.message).toContain('gspot unignore --paths <path>');
});

import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import type { TomlTable } from '#cli/types/settings.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';
import { REFUSAL_FILES, IGNORE_REFUSALS, UNKNOWN_IGNORE_ARGUMENTS } from '#tests/config/commands/edits.ts';

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
    const refused = await runGspot(sandbox.path, ['ignore', 'gspot/weakenings', ...reason]);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('names one rule');
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
    for (const [check, rule, message] of [
        ['javascript/eslint', 'no-consolee', 'gspot does not know rule no-consolee of javascript/eslint.'],
        ['bash/shfmt', 'indent', 'bash/shfmt does not report lint rules. Omit --rule.'],
    ] as const) {
        const result = await runGspot(sandbox.path, [
            'ignore',
            check,
            '--rule',
            rule,
            '--reason',
            'The generated source needs this exception.',
        ]);
        expect(result.code).toBe(2);
        expect(result.stderr).toBe(`${message}\n`);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(settings);
    }
});

test.each([...IGNORE_REFUSALS])(
    'ignore refuses $name without writing',
    async ({ arguments: commandArguments, message }) => {
        await using sandbox = await createGitSandbox(REFUSAL_FILES);
        await assertRefusalWithoutWrites(sandbox.path, commandArguments, { error: 'arguments', message });
    },
);

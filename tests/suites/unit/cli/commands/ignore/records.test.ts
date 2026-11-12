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

test('ignore of an unknown check exits 2, names the close check, and leaves gspot.toml byte for byte', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });
    const failure = await assertRefusalWithoutWrites(sandbox.path, UNKNOWN_IGNORE_ARGUMENTS, 'arguments');
    expect(failure.message).toBe('There is no check called bash/shelcheck. Did you mean bash/shellcheck?');
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

test.each([
    {
        check: 'javascript/eslint',
        rule: 'no-consolee',
        message: 'gspot does not know rule no-consolee of javascript/eslint.',
    },
    {
        check: 'bash/shfmt',
        rule: 'indent',
        message:
            'gspot cannot ignore one lint rule of bash/shfmt. Leave out --rule, and give --paths to ignore the check for those files.',
    },
])('ignore refuses rule $rule of $check and writes nothing', async ({ check, rule, message }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'bash']),
        'source.js': 'export const count = 1;\n',
        '.gspot/node_modules/eslint/package.json': '{"exports":{"./use-at-your-own-risk":"./rules.cjs"}}',
        '.gspot/node_modules/eslint/rules.cjs': 'exports.builtinRules = new Map();',
    });
    const failure = await assertRefusalWithoutWrites(
        sandbox.path,
        ['ignore', check, '--rule', rule, '--reason', 'The generated source needs this exception.'],
        'arguments',
    );
    expect(failure.message).toBe(message);
});

test('ignore accepts a rule of a plugin that exports only an import entry', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'astro']),
        'source.js': 'export const count = 1;\n',
        '.gspot/node_modules/eslint-plugin-astro/package.json':
            '{"type":"module","exports":{".":{"types":"./index.d.mts","import":"./index.mjs"}}}',
        '.gspot/node_modules/eslint-plugin-astro/index.mjs':
            'export default { rules: { "no-set-html-directive": { meta: { docs: { description: "Disallow set:html." } } } } };\n',
    });
    const rule = 'astro/no-set-html-directive';
    const reason = 'The page renders sanitized Markdown.';
    const result = await runGspot(sandbox.path, ['ignore', 'javascript/eslint', '--rule', rule, '--reason', reason]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toStrictEqual([{ check: 'javascript/eslint', rule, reason }]);
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

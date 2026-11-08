import { readFileSync } from 'node:fs';
import { readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { settingsListOutputSchema } from '#cli/schemas/commands.ts';
import { readSettings } from '#cli/settings/read.ts';
import { findValueAt } from '#cli/system/tables.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import {
    KEPT_SETTING_CHANGES,
    STOPPED_APPLY_FILES,
    STRING_SETTING_VALUES,
    WEAKENED_SETTINGS,
} from '#tests/config/commands/edits.ts';
import { ROOT_EDITORCONFIG } from '#tests/config/commands/reports.ts';
import { SETTING_REASON } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

test('set writes and unset removes a setting of a selected configuration', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses']),
        'package.json': '{ "name": "example", "private": true }\n',
    });
    const set = await runGspot(sandbox.path, ['set', 'licenses.allowed', 'MIT']);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(findValueAt(written, ['licenses', 'allowed'])).toStrictEqual(['MIT']);
    const unset = await runGspot(sandbox.path, ['unset', 'licenses.allowed']);
    expect(unset.code, unset.stdout + unset.stderr).toBe(0);
    const reset = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(findValueAt(reset, ['licenses', 'allowed'])).toBeUndefined();
});

test('set names -- when a value reads as an option, and takes the values after --', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const refused = await runGspot(sandbox.path, [
        'set',
        'ci.setup_command',
        'bun',
        'install',
        '--frozen-lockfile',
        '--json',
    ]);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('gspot set ci.setup_command -- bun install --frozen-lockfile') as string,
    });
    const set = await runGspot(sandbox.path, ['set', 'ci.setup_command', '--', 'bun', 'install', '--frozen-lockfile']);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(findValueAt(written, ['ci', 'setup_command'])).toStrictEqual(['bun', 'install', '--frozen-lockfile']);
});

test.each([...KEPT_SETTING_CHANGES])(
    '%s keeps its change in gspot.toml and exits 2 when the write of the generated files then stops',
    async (_, commandArguments, written) => {
        await using sandbox = await createGitSandbox(STOPPED_APPLY_FILES);

        await applyGeneratedFiles(sandbox.path);
        const generated = join(sandbox.path, '.editorconfig');
        const authored = join(sandbox.path, 'authored-editorconfig');
        await writeFile(authored, ROOT_EDITORCONFIG);
        await rm(generated);
        await symlink('authored-editorconfig', generated);
        const stopped = await runGspot(sandbox.path, [...commandArguments, '--json']);
        expect(stopped.code, stopped.stdout + stopped.stderr).toBe(2);
        expect(JSON.parse(stopped.stdout)).toMatchObject({ error: 'writing' });
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain(written);
        expect(await readFile(authored, 'utf8')).toBe(ROOT_EDITORCONFIG);
    },
);

test('set takes each word of a list as an item, without one pair of TOML quotes', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const set = await runGspot(sandbox.path, ['set', 'ci.setup_command', '"bun"', "'install'", 'plain']);
    expect(set.code, set.stdout + set.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(findValueAt(written, ['ci', 'setup_command'])).toStrictEqual(['bun', 'install', 'plain']);
});

test('set takes one word for a scalar', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const refused = await runGspot(sandbox.path, ['set', 'level', 'all', 'basic', '--json']);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'arguments' });
});

test('set writes a TOML list of tables as tables and refuses a list of strings', async () => {
    await using sandbox = await createGitSandbox({
        'README.md': '# test\n',
        'gspot.toml': buildSandboxSettings(['docs', 'javascript']),
    });

    commitAll(sandbox.path);
    const written = await runGspot(sandbox.path, [
        'set',
        'javascript.banned_imports',
        `[{name = "unreviewed-module", message = "Import the reviewed entrypoint for this dependency."}]`,
    ]);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(findValueAt(parse(settings) as TomlTable, ['javascript', 'banned_imports'])).toStrictEqual([
        { name: 'unreviewed-module', message: 'Import the reviewed entrypoint for this dependency.' },
    ]);
    const refused = await runGspot(sandbox.path, [
        'set',
        'javascript.banned_imports',
        String.raw`["{name = \"a\", message = \"Use its public entrypoint.\"}"]`,
        '--json',
    ]);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'arguments' });
});

test('set level all writes the level in a fresh clone', async () => {
    await using sandbox = await createGitSandbox({});
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    await createFileTree(source, {
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });
    runGitStep(source, ['init', '-q']);
    await applyGeneratedFiles(source);
    commitAll(source);
    runGitStep(sandbox.path, ['clone', '--quiet', source, checkout]);
    const changed = await runGspot(checkout, ['set', 'level', 'all']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    const settings = readSettings(readFileSync(join(checkout, SETTINGS_FILE), 'utf8'), checkout).level;
    expect(settings).toBe('all');
});

test.each([...WEAKENED_SETTINGS])(
    'set refuses $key without --reason, and set and unset keep its reason through list edits',
    async ({ key, value, second }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['typescript', 'site'], { level: 'all' }),
            'entry.ts': 'export const port = 8080;\n',
        });
        const refused = await runGspot(sandbox.path, ['set', key, value, '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(JSON.parse(refused.stdout)).toMatchObject({
            error: 'arguments',
            message: expect.stringContaining('Add --reason') as string,
        });
        for (const commandArguments of [
            ['set', key, value, second, '--reason', SETTING_REASON],
            ['unset', key, value],
        ]) {
            const result = await runGspot(sandbox.path, commandArguments);
            expect(result.code, result.stdout + result.stderr).toBe(0);
        }
        const contents = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
        const saved = findValueAt(contents, key.split('.'));
        expect(saved).toStrictEqual({ value: [second], reason: SETTING_REASON });
    },
);

test.each([...WEAKENED_SETTINGS])(
    '$key set in one scope keeps the root value, and unset gives the scope the inherited value again',
    async ({ key, value, second }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['typescript', 'site'], {
                level: 'all',
                tables: `${key} = { value = ${JSON.stringify([second])}, reason = ${JSON.stringify(SETTING_REASON)} }\n[[scope]]\npath = "app"\n[[scope]]\npath = "sibling"\n`,
            }),
            'entry.ts': 'export const port = 8080;\n',
            'app/entry.ts': 'export const port = 8081;\n',
            'sibling/entry.ts': 'export const port = 8082;\n',
        });
        const changed = await runGspot(sandbox.path, ['set', key, value, '--scope', 'app', '--reason', SETTING_REASON]);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        const saved = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
        expect(findValueAt(saved, key.split('.'))).toMatchObject({ value: [second], reason: SETTING_REASON });
        const restored = await runGspot(sandbox.path, ['unset', key, '--scope', 'app']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        const listed = await runGspot(sandbox.path, ['list', 'settings', '--json']);
        expect(listed.code, listed.stdout + listed.stderr).toBe(0);
        expect(
            settingsListOutputSchema
                .parse(JSON.parse(listed.stdout))
                .settings.filter((row) => row.setting === key)
                .map(({ value }) => value),
        ).toStrictEqual([[second], [second], [second]]);
    },
);

test('spelling.allowed_words keeps one reason for each word through edits', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'entry.ts': 'export const port = 8080;\n',
    });
    const refused = await runGspot(sandbox.path, ['set', 'spelling.allowed_words', 'Nebulix', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('--reason') as string,
    });
    for (const commandArguments of [
        ['set', 'spelling.allowed_words', 'Nebulix', '--reason', 'The product name stays as the vendor writes it.'],
        ['set', 'spelling.allowed_words', 'Quorbit', '--reason', SETTING_REASON],
        ['unset', 'spelling.allowed_words', 'Nebulix'],
    ]) {
        const result = await runGspot(sandbox.path, commandArguments);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const saved = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(saved['spelling']).toStrictEqual({ allowed_words: { Quorbit: SETTING_REASON } });
});

test.each([...STRING_SETTING_VALUES])('set keeps words as strings for $key: $words', async ({ key, words, value }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['set', key, ...words]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(findValueAt(written, key.split('.'))).toStrictEqual(value);
});

test('--json after the value separator stays a setup command argument', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['set', 'ci.setup_command', '--', 'echo', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).not.toStartWith('{');
    expect(result.stderr).toBe('');
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(findValueAt(written, ['ci', 'setup_command'])).toStrictEqual(['echo', '--json']);
});

test('set replaces the written values of an ordinary list', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const first = await runGspot(sandbox.path, ['set', 'naming.banned_words', 'firstword']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const second = await runGspot(sandbox.path, ['set', 'naming.banned_words', 'secondword']);
    expect(second.code, second.stdout + second.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    const contents = findValueAt(written, ['naming', 'banned_words']);
    expect(contents).toStrictEqual(['secondword']);
});

test('unset says when an empty list turns a check off, and unset of a shipped value says nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['licenses'], { tables: '[licenses]\nallowed = ["MIT"]\n' }),
    });
    const unset = await runGspot(sandbox.path, ['unset', 'licenses.allowed']);
    expect(unset.code, unset.stdout + unset.stderr).toBe(0);
    expect(unset.stdout).toContain('This turns off licenses/allowed.');
});

test('an edit in one scope does not say it turns off a check that the other scope leaves empty', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: [
                '[[scope]]',
                'path = "api"',
                'configurations = ["openapi"]',
                'openapi = { document = "openapi.yaml" }',
                '[[scope]]',
                'path = "web"',
                'configurations = ["openapi"]',
                '',
            ].join('\n'),
        }),
        'api/openapi.yaml': 'openapi: 3.1.0\n',
        'web/page.md': '# Page\n',
    });
    const result = await runGspot(sandbox.path, ['set', 'limits.max_file_lines', '100']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).not.toContain('This turns off');
});

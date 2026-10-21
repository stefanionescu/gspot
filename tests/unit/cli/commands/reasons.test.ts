import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@decimalturn/toml-patch';
import { readTree } from '#tests/setup/files.ts';
import { getValueAt } from '#cli/system/values.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { type SettingsListJson } from '#cli/types/commands/list.ts';
import { SETTING_REASON, LOOSENED_SETTINGS } from '#tests/data/commands/set.ts';

test.each([...LOOSENED_SETTINGS])('$key keeps its reason through list edits', async ({ key, value, second }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'site'], { level: 'all' }),
        'entry.ts': 'export const port = 8080;\n',
    });
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, ['set', key, value]);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('reason');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    for (const commandArguments of [
        ['set', key, value, '--reason', SETTING_REASON],
        ['set', key, second, '--reason', SETTING_REASON],
        ['unset', key, value],
    ]) {
        const result = await runGspot(sandbox.path, commandArguments);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const saved = getValueAt(
        parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable,
        key.split('.'),
    );
    expect(saved).toMatchObject({ value: [second], reason: SETTING_REASON });
});

test('allowed_words keeps one reason for each word through edits', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'entry.ts': 'export const port = 8080;\n',
    });
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, ['set', 'allowed_words', 'Nebulix']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('allowed_words keeps a reason for each entry');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    for (const commandArguments of [
        ['set', 'allowed_words', 'Nebulix', '--reason', 'The product name stays as the vendor writes it.'],
        ['set', 'allowed_words', 'Quorbit', '--reason', SETTING_REASON],
        ['unset', 'allowed_words', 'Nebulix'],
    ]) {
        const result = await runGspot(sandbox.path, commandArguments);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const saved = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(saved['allowed_words']).toStrictEqual({ Quorbit: SETTING_REASON });
});

test('a reason on a value that does not loosen the default is refused before writing', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {}),
        'entry.ts': 'export const port = 8080;\n',
    });
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['set', 'spelling.locale', 'en-gb', '--reason', SETTING_REASON]);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stderr).toContain('spelling.locale takes no reason here');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([...LOOSENED_SETTINGS])(
    '$key set in a scope keeps root and sibling reasons, and unset restores inheritance',
    async ({ key, value, second, defaults }) => {
        await using sandbox = await testdir({
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
        expect(getValueAt(saved, key.split('.'))).toMatchObject({ value: [second], reason: SETTING_REASON });
        const restored = await runGspot(sandbox.path, ['unset', key, '--scope', 'app']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        const listed = await runGspot(sandbox.path, ['list', 'settings', '--json']);
        expect(listed.code, listed.stdout + listed.stderr).toBe(0);
        expect(
            (JSON.parse(listed.stdout) as SettingsListJson).settings
                .filter((row) => row.key === key)
                .map(({ value }) => value),
        ).toStrictEqual([
            [...defaults, second],
            [...defaults.map((value) => (key === 'site.allowed_unlisted_pages' ? `app/${value}` : value)), second],
            [...defaults.map((value) => (key === 'site.allowed_unlisted_pages' ? `sibling/${value}` : value)), second],
        ]);
    },
);

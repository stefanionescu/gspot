import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { readTree } from '#tests/setup/files.ts';
import { getValueAt } from '#cli/system/values.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { type SettingsListJson } from '#cli/types/commands/list.ts';
import { SETTING_REASON, LOOSENED_SETTINGS } from '#tests/data/commands/set.ts';

test.each([...LOOSENED_SETTINGS])('$key keeps its reason through list edits', async ({ key, value, second }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['typescript', 'site'], { level: 'all' }),
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
        parse(await Bun.file(join(sandbox.path, 'gspot.toml')).text()) as TomlTable,
        key.split('.'),
    );
    expect(saved).toMatchObject({ value: [second], reason: SETTING_REASON });
});

test.each(LOOSENED_SETTINGS.filter(({ key }) => key !== 'allowed_words'))(
    '$key set in a scope keeps root and sibling reasons, and unset restores inheritance',
    async ({ key, value, second, defaults }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['typescript', 'site'], {
                level: 'all',
                tables: `${key} = { value = ${JSON.stringify([second])}, reason = ${JSON.stringify(SETTING_REASON)} }\n[[scope]]\npath = "app"\n[[scope]]\npath = "sibling"\n`,
            }),
            'entry.ts': 'export const port = 8080;\n',
            'app/entry.ts': 'export const port = 8081;\n',
            'sibling/entry.ts': 'export const port = 8082;\n',
        });
        const changed = await runGspot(sandbox.path, ['set', key, value, '--scope', 'app', '--reason', SETTING_REASON]);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        const saved = parse(await Bun.file(join(sandbox.path, 'gspot.toml')).text()) as TomlTable;
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

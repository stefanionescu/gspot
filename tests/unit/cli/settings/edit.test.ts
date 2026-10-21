import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { getValueAt } from '#cli/system/tables.ts';
import { parseTomlText } from '#cli/settings/file.ts';
import { localDateSchema } from '#cli/schemas/settings/parts.ts';
import { DATED_IGNORE, INITIAL_SETTINGS } from '#tests/data/settings/edits.ts';

import {
    setKey,
    addToList,
    deleteKey,
    getScopeTable,
    readSettingsEdit,
    buildEditedSettings,
} from '#cli/settings/edit.ts';

test('an edit keeps a trailing array comma and writes inline tables without one', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, '# Authored selection.\nconfigurations = ["security",]\n');
    const entry = {
        check: 'security/semgrep',
        rule: 'js/file-system-race',
        paths: ['fixture.js'],
        reason: 'The sandbox owns its temporary files.',
    };
    const edit = readSettingsEdit(sandbox.path);
    setKey(edit.table, 'ignore', [entry]);
    const proposed = buildEditedSettings(sandbox.path, edit);
    expect(proposed.text).toContain('# Authored selection.');
    expect(proposed.text).not.toMatch(/,\s*\}/u);
    expect(proposed.settings.ignore).toStrictEqual([entry]);
    await writeFile(path, proposed.text);
    const unchanged = readSettingsEdit(sandbox.path);
    setKey(unchanged.table, 'ignore', [entry]);
    expect(buildEditedSettings(sandbox.path, unchanged).changed).toBe(false);
});

test('setting a nested key, then deleting it, removes the empty table', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, INITIAL_SETTINGS);
    const addedEdit = readSettingsEdit(sandbox.path);
    setKey(addedEdit.table, 'limits.bash.file_lines', 100);
    const written = buildEditedSettings(sandbox.path, addedEdit).text;
    expect(written).toContain('[limits.bash]');
    await writeFile(path, written);
    const removedEdit = readSettingsEdit(sandbox.path);
    deleteKey(removedEdit.table, 'limits.bash.file_lines');
    const removed = buildEditedSettings(sandbox.path, removedEdit).text;
    expect(removed).not.toContain('[limits');
});

test('adding to a list skips values that are already there', async () => {
    await using sandbox = await testdir();
    await writeFile(join(sandbox.path, 'gspot.toml'), INITIAL_SETTINGS);
    const edit = readSettingsEdit(sandbox.path);
    addToList(edit.table, 'naming.banned_words', ['dispatcher', 'orchestrator']);
    addToList(edit.table, 'naming.banned_words', ['dispatcher']);
    const written = buildEditedSettings(sandbox.path, edit).text;
    expect(getValueAt(parseTomlText(written, 'gspot.toml'), ['naming', 'banned_words'])).toStrictEqual([
        'dispatcher',
        'orchestrator',
    ]);
});

test.each([
    ['a dotted key', 'limits.file_lines = 100'],
    ['an inline table', 'limits = { file_lines = 100 }'],
])('a scope setting written into %s loads with the settings already there', async (_form, scope) => {
    await using sandbox = await testdir();
    await writeFile(join(sandbox.path, 'gspot.toml'), `${INITIAL_SETTINGS}[[scope]]\npath = "api"\n${scope}\n`);
    const edit = readSettingsEdit(sandbox.path);
    setKey(getScopeTable(edit.table, 'api'), 'limits.function_lines', 20);
    const result = buildEditedSettings(sandbox.path, edit);
    expect(result.settings.scopes['api']?.limits).toMatchObject({ file_lines: 100, function_lines: 20 });
    await writeFile(join(sandbox.path, 'gspot.toml'), result.text);
    expect(readSettingsEdit(sandbox.path).table['scope']).toMatchObject([
        { path: 'api', limits: { file_lines: 100, function_lines: 20 } },
    ]);
});

test('changing an until date in place rewrites it and keeps its comment', async () => {
    await using sandbox = await testdir();
    await writeFile(join(sandbox.path, 'gspot.toml'), DATED_IGNORE);
    const input = readSettingsEdit(sandbox.path);
    const until = localDateSchema.parse(getValueAt(input.table, ['ignore', 0, 'until']));
    until.setUTCDate(21);
    const result = buildEditedSettings(sandbox.path, input);
    expect(result.changed).toBe(true);
    expect(result.text).toContain('# Keep the authored expiry.');
    expect(result.text).toContain('until = 2099-05-21');
});

test('reordering keys does not change the file', async () => {
    await using sandbox = await testdir();
    const source = `${INITIAL_SETTINGS}level = "all"\n`;
    await writeFile(join(sandbox.path, 'gspot.toml'), source);
    const edit = readSettingsEdit(sandbox.path);
    const configurations = edit.table['configurations'];
    Reflect.deleteProperty(edit.table, 'configurations');
    edit.table['configurations'] = configurations;
    const result = buildEditedSettings(sandbox.path, edit);
    expect(result.changed).toBe(false);
    expect(result.text).toBe(source);
});

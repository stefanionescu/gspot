import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { getValueAt } from '#cli/system/tables.ts';
import { SCHEMA_DIRECTIVE } from '#cli/config/settings/file.ts';
import { localDateSchema } from '#cli/schemas/settings/fields.ts';
import { setKey, deleteKey, getScopeTable, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';
import { DATED_IGNORE, SEMGREP_IGNORE, INITIAL_SETTINGS, SCOPE_SETTING_WRITES } from '#tests/config/settings/edit.ts';

test('an edit writes the new ignore as a table and keeps the authored comment', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, `${SCHEMA_DIRECTIVE}\n# Authored selection.\nconfigurations = ["security",]\n`);
    const edit = readSettingsEdit(sandbox.path);
    setKey(edit.table, 'ignore', [SEMGREP_IGNORE]);
    const proposed = buildEditedSettings(sandbox.path, edit);
    expect(proposed.text).toBe(
        `${SCHEMA_DIRECTIVE}\n` +
            '# Authored selection.\nconfigurations = ["security"]\n\n[[ignore]]\ncheck = "security/semgrep"\nrule = "js/file-system-race"\npaths = ["fixture.js"]\nreason = "The sandbox owns its temporary files."\n',
    );
    expect(proposed.settings.ignore).toStrictEqual([SEMGREP_IGNORE]);
    await writeFile(path, proposed.text);
    const unchanged = readSettingsEdit(sandbox.path);
    setKey(unchanged.table, 'ignore', [SEMGREP_IGNORE]);
    expect(buildEditedSettings(sandbox.path, unchanged).changed).toBe(false);
});

test('setting a nested key, then deleting it, removes the empty table', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, INITIAL_SETTINGS);
    const addedEdit = readSettingsEdit(sandbox.path);
    setKey(addedEdit.table, 'limits.bash.file_lines', 100);
    const written = buildEditedSettings(sandbox.path, addedEdit).text;
    expect(written).toBe(`${INITIAL_SETTINGS}\n[limits.bash]\nfile_lines = 100\n`);
    await writeFile(path, written);
    const removedEdit = readSettingsEdit(sandbox.path);
    deleteKey(removedEdit.table, 'limits.bash.file_lines');
    const removed = buildEditedSettings(sandbox.path, removedEdit).text;
    expect(removed).toBe(INITIAL_SETTINGS);
});

test.each([...SCOPE_SETTING_WRITES])(
    'a scope setting written into %s loads with the settings already there',
    async (_form, scope) => {
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
    },
);

test('changing an until date in place rewrites it and keeps its comment', async () => {
    await using sandbox = await testdir();
    await writeFile(join(sandbox.path, 'gspot.toml'), DATED_IGNORE);
    const input = readSettingsEdit(sandbox.path);
    const until = localDateSchema.parse(getValueAt(input.table, ['ignore', 0, 'until']));
    until.setUTCDate(21);
    const result = buildEditedSettings(sandbox.path, input);
    expect(result.changed).toBe(true);
    expect(result.text).toBe(DATED_IGNORE.replace('2099-05-20', '2099-05-21').replace('\n#', '\n\n#'));
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

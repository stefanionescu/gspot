import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { SCHEMA_DIRECTIVE } from '#cli/config/settings/text.ts';
import { SEMGREP_IGNORE, INITIAL_SETTINGS, SCOPE_SETTING_WRITES } from '#tests/config/settings/edit.ts';
import { setKey, removeKey, getScopeTable, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';

test('an edit writes the new ignore as a table and keeps the authored comment', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, `${SCHEMA_DIRECTIVE}\n# Authored selection.\nconfigurations = ["security",]\n`);
    const edit = readSettingsEdit(sandbox.path);
    setKey(edit.table, 'ignore', [SEMGREP_IGNORE]);
    const proposed = buildEditedSettings(sandbox.path, edit);
    expect(proposed.text).toBe(
        `${SCHEMA_DIRECTIVE}\n` +
            '# Authored selection.\nconfigurations = ["security",]\n\n[[ignore]]\ncheck = "security/semgrep"\nrule = "js/file-system-race"\npaths = ["sample.js"]\nreason = "The sandbox owns its temporary files."\n',
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
    expect(written).toBe(`${INITIAL_SETTINGS}\n[limits]\nbash = { file_lines = 100 }\n`);
    await writeFile(path, written);
    const removedEdit = readSettingsEdit(sandbox.path);
    removeKey(removedEdit.table, 'limits.bash.file_lines');
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
        expect(result.settings.scopes.get('api')?.limits).toMatchObject({ file_lines: 100, function_lines: 20 });
        await writeFile(join(sandbox.path, 'gspot.toml'), result.text);
        expect(readSettingsEdit(sandbox.path).table['scope']).toMatchObject([
            { path: 'api', limits: { file_lines: 100, function_lines: 20 } },
        ]);
    },
);

test('an invalid edit reports the setting without inventing a saved line', async () => {
    await using sandbox = await testdir();
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        `${INITIAL_SETTINGS}# Authored limits.\n[limits]\nfile_lines = 100\n`,
    );
    const invalid = readSettingsEdit(sandbox.path);
    setKey(invalid.table, 'limits.function_lines', 'long');
    expect(() => buildEditedSettings(sandbox.path, invalid)).toThrow('limits.function_lines:');
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

test('an edit writes a new list longer than format.print_width one item per line, as Taplo does', async () => {
    await using sandbox = await testdir({
        'gspot.toml': `${INITIAL_SETTINGS}\n[format]\nprint_width = 40\nindent_width = 2\n`,
    });
    const edit = readSettingsEdit(sandbox.path);
    setKey(edit.table, 'naming.banned_words', ['alpha', 'beta']);
    setKey(edit.table, 'test_files', ['generated/first/**', 'generated/second/**']);
    const result = buildEditedSettings(sandbox.path, edit);
    expect(result.text).toBe(
        `${INITIAL_SETTINGS}test_files = [\n  "generated/first/**",\n  "generated/second/**",\n]\n\n[format]\nprint_width = 40\nindent_width = 2\n\n[naming]\nbanned_words = ["alpha", "beta"]\n`,
    );
});

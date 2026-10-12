import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { valueAt } from '#cli/objects.ts';
import { writeFile } from 'node:fs/promises';
import { localDateSchema } from '#cli/settings/schema/parts.ts';
import { DATED_IGNORE } from '#tests/config/samples/settings.ts';
import { setKey, addToList, deleteKey, editSettings, findScopeTable, readSettingsEdit } from '#cli/settings/edit.ts';

const initial = 'configurations = ["bash", "naming", "format"]\n';

test('an edit keeps a trailing array comma and writes inline tables without one', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, '# Authored selection.\nconfigurations = ["security",]\n');
    const entry = {
        check: 'security/codeql',
        rule: 'js/file-system-race',
        paths: ['fixture.js'],
        reason: 'The sandbox owns its temporary files.',
    };
    const proposed = editSettings(sandbox.path, readSettingsEdit(sandbox.path), (written) => {
        setKey(written, 'ignore', [entry]);
    });
    expect(proposed.text).toContain('# Authored selection.');
    expect(proposed.text).not.toMatch(/,\s*\}/u);
    expect(proposed.settings.ignore).toStrictEqual([entry]);
    await writeFile(path, proposed.text);
    expect(
        editSettings(sandbox.path, readSettingsEdit(sandbox.path), (written) => {
            setKey(written, 'ignore', [entry]);
        }).changed,
    ).toBe(false);
});

test('setting a nested key, then deleting it, removes the empty table', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, initial);
    const written = editSettings(sandbox.path, readSettingsEdit(sandbox.path), (written) => {
        setKey(written, 'limits.bash.file_lines', 100);
    }).text;
    expect(written).toContain('[limits.bash]');
    await writeFile(path, written);
    const removed = editSettings(sandbox.path, readSettingsEdit(sandbox.path), (written) => {
        deleteKey(written, 'limits.bash.file_lines');
    }).text;
    expect(removed).not.toContain('[limits');
});

test('adding to a list skips values and records that are already there', async () => {
    await using sandbox = await testdir();
    await writeFile(join(sandbox.path, 'gspot.toml'), initial);
    const written = editSettings(sandbox.path, readSettingsEdit(sandbox.path), (written) => {
        addToList(written, 'naming.banned_words', ['dispatcher', 'orchestrator']);
        addToList(written, 'naming.banned_words', ['dispatcher']);
        addToList(written, 'format.override', [
            { paths: ['legacy/**'], indent_style: 'tab' },
            { indent_style: 'tab', paths: ['legacy/**'] },
        ]);
    }).text;
    expect(written.match(/dispatcher/gu)).toHaveLength(1);
    expect(written.match(/legacy\/\*\*/gu)).toHaveLength(1);
});

test.each([
    ['a dotted key', 'limits.file_lines = 100'],
    ['an inline table', 'limits = { file_lines = 100 }'],
])('a scope setting written into %s loads with the settings already there', async (_form, scope) => {
    await using sandbox = await testdir();
    await writeFile(join(sandbox.path, 'gspot.toml'), `${initial}[[scope]]\npath = "api"\n${scope}\n`);
    const result = editSettings(sandbox.path, readSettingsEdit(sandbox.path), (written) => {
        setKey(findScopeTable(written, 'api'), 'limits.function_lines', 20);
    });
    expect(result.settings.scopeTables['api']?.limits).toMatchObject({ file_lines: 100, function_lines: 20 });
    await writeFile(join(sandbox.path, 'gspot.toml'), result.text);
    expect(readSettingsEdit(sandbox.path).table['scope']).toMatchObject([
        { path: 'api', limits: { file_lines: 100, function_lines: 20 } },
    ]);
});

test('changing an until date in place rewrites it and keeps its comment', async () => {
    await using sandbox = await testdir();
    const source = DATED_IGNORE;
    await writeFile(join(sandbox.path, 'gspot.toml'), source);
    const input = readSettingsEdit(sandbox.path);
    const until = localDateSchema.parse(valueAt(input.table, ['ignore', 0, 'until']));
    const original = input.values;
    const result = editSettings(sandbox.path, input, () => until.setUTCDate(21));
    expect(result.changed).toBe(true);
    expect(result.text).toContain('# Keep the authored expiry.');
    expect(result.text).toContain('until = 2099-05-21');
    expect(input.values).toBe(original);
});

test('reordering keys does not change the file', async () => {
    await using sandbox = await testdir();
    const source = `${initial}level = "all"\n`;
    await writeFile(join(sandbox.path, 'gspot.toml'), source);
    const result = editSettings(sandbox.path, readSettingsEdit(sandbox.path), (written) => {
        const configurations = written['configurations'];
        Reflect.deleteProperty(written, 'configurations');
        written['configurations'] = configurations;
    });
    expect(result.changed).toBe(false);
    expect(result.text).toBe(source);
});

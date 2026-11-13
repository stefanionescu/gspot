import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { buildInitSettings } from '#cli/generation/setup/settings.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { listRepositoryFiles, readRepository } from '#cli/repository/read.ts';
import { addScopeTable, buildEditedSettings, setKey } from '#cli/settings/toml/edit.ts';
import { readSettingsFile } from '#cli/settings/toml/file.ts';
import { buildSettingsText } from '#cli/settings/toml/text.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { FIELD_COMMENT_CASES } from '#tests/config/settings/parse.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...FIELD_COMMENT_CASES])(
    'a template keeps each comment of $name on its key',
    ({ source, target, expected }) => {
        const table = parseTomlFile('gspot.toml', target);
        const written = buildSettingsText(source, table);
        expect(written).toBe(expected);
    },
);

test('a new table goes above the comment of the next table', () => {
    const source = 'level = "basic"\n\n# Wide screens.\n[format]\nprint_width = 120\n';
    const written = { ...parseTomlFile('gspot.toml', source), ci: { enabled: true } };
    expect(buildSettingsText(source, written)).toBe(
        'level = "basic"\n\n[ci]\nenabled = true\n\n# Wide screens.\n[format]\nprint_width = 120\n',
    );
});

test('a key set in a later scope writes a table that an earlier scope extends with a dotted key', () => {
    const source =
        '[[scope]]\npath = "a"\njavascript.allowed_unused_dependencies = { value = ["x"], reason = "The loader needs it." }\n\n[[scope]]\npath = "b"\n';
    const table = parseTomlFile('gspot.toml', source);
    const value = { value: ['y'], reason: 'The loader needs it too.' };
    setKey(addScopeTable(table, 'b'), 'javascript.allowed_unused_dependencies', value);
    const written = buildSettingsText(source, table);
    expect(written).toBe(
        `${source}javascript = { allowed_unused_dependencies = { value = ["y"], reason = "The loader needs it too." } }\n`,
    );
    expect(parseTomlFile('gspot.toml', written)['scope']).toStrictEqual([
        { path: 'a', javascript: { allowed_unused_dependencies: { value: ['x'], reason: 'The loader needs it.' } } },
        { path: 'b', javascript: { allowed_unused_dependencies: value } },
    ]);
});

test('setting level keeps the opening init comments first', async () => {
    await using sandbox = await createGitSandbox({});
    const cache = createRunCache(sandbox.path);
    const repository = await readRepository(cache, await listRepositoryFiles(cache), {
        generatedPaths: [],
        scopes: [],
    });
    const text = buildInitSettings(
        { configurations: [], scopes: [], base: '', prettierScripts: new Map(), trackedPaths: [] },
        repository,
    );
    await createFileTree(sandbox.path, { 'gspot.toml': text });
    const edit = readSettingsFile(sandbox.path);
    setKey(edit.table, 'level', 'all');
    const result = buildEditedSettings(sandbox.path, edit);
    const preface = text.split('\n').filter((line) => line.startsWith('# '));
    expect(preface.length).toBeGreaterThan(1);
    expect(result.text.split('\n').slice(0, preface.length + 1)).toStrictEqual([...preface, 'level = "all"']);
});

test('setting level keeps a written value equal to its default', async () => {
    await using sandbox = await testdir({
        'gspot.toml': `configurations = ["bash"]\n\n# Keep the chosen format.\n[format]\nprint_width = 120\nindent_width = 4\n`,
    });
    const edit = readSettingsFile(sandbox.path);
    setKey(edit.table, 'level', 'all');
    const result = buildEditedSettings(sandbox.path, edit);
    expect(result.text).toBe(
        `level = "all"\nconfigurations = ["bash"]\n\n# Keep the chosen format.\n[format]\nprint_width = 120\nindent_width = 4\n`,
    );
});

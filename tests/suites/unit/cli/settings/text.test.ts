import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildSettingsText } from '#cli/settings/text.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildInitSettings } from '#cli/commands/init/settings-text.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';
import { ARRAY_COMMENT_CASES } from '#tests/config/settings/text/array-comments.ts';
import { FIELD_COMMENT_CASES } from '#tests/config/settings/text/field-comments.ts';
import { setKey, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';
import { IGNORE_COMMENT_CASES } from '#tests/config/settings/text/ignore-comments.ts';

test.each([...IGNORE_COMMENT_CASES, ...ARRAY_COMMENT_CASES, ...FIELD_COMMENT_CASES])(
    'a template keeps each comment of $name on its key',
    ({ source, target, expected }) => {
        const table = parseTomlFile('gspot.toml', target ?? source);
        const written = buildSettingsText('', source, table);
        expect(written).toBe(`#:schema ./.gspot/gspot.schema.json\n${expected}`);
    },
);

test('a template keeps authored spelling, record order, comments, and inline tables', () => {
    const source = '# Authored selection.\nconfigurations=["bash",]\n\n[format]\nindent_width=4 # Keep the indent.\n';
    const written = parseTomlFile('gspot.toml', source);
    const output = buildSettingsText('', source, written);
    expect(output).toBe(`#:schema ./.gspot/gspot.schema.json\n${source}`);
});

test('setting level keeps the schema directive first and the opening init comment after it', async () => {
    await using sandbox = await testdir();
    const reads = createReadCache(sandbox.path);
    const configurationsByName = readConfigurations();
    const repository = await readRepository(reads, await listRepositoryFiles(reads), {
        generatedPaths: [],
        scopes: [],
        configurationsByName,
    });
    const text = buildInitSettings({ configurations: [], scopes: [], base: '' }, repository, configurationsByName);
    await createFileTree(sandbox.path, { 'gspot.toml': text });
    const edit = readSettingsEdit(sandbox.path);
    setKey(edit.table, 'level', 'all');
    const result = buildEditedSettings(sandbox.path, edit);
    const [directive, opening] = result.text.split('\n', 2);
    expect(directive).toBe('#:schema ./.gspot/gspot.schema.json');
    expect(opening).toBe('# Change these settings with gspot set, unset, add, remove, ignore, or unignore.');
    expect(result.settings.level).toBe('all');
});

test('setting level keeps a written value equal to its default', async () => {
    await using sandbox = await testdir({
        'gspot.toml': `#:schema ./.gspot/gspot.schema.json\nconfigurations = ["bash"]\n\n# Keep the chosen format.\n[format]\nprint_width = 120\nindent_width = 4\n`,
    });
    const edit = readSettingsEdit(sandbox.path);
    setKey(edit.table, 'level', 'all');
    const result = buildEditedSettings(sandbox.path, edit);
    expect(result.text).toBe(
        `#:schema ./.gspot/gspot.schema.json\nconfigurations = ["bash"]\n\nlevel = "all"\n# Keep the chosen format.\n[format]\nprint_width = 120\nindent_width = 4\n`,
    );
});

import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildSettingsText } from '#cli/settings/text.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { SCHEMA_DIRECTIVE } from '#cli/config/settings/text.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildInitSettings } from '#cli/commands/init/settings-text.ts';
import { PREFACE_BODY } from '#cli/config/commands/init/settings-text.ts';
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
        expect(written).toBe(`${SCHEMA_DIRECTIVE}\n${expected}`);
    },
);

test('a template keeps authored spelling, record order, comments, and inline tables', () => {
    const source = '# Authored selection.\nconfigurations=["bash",]\n\n[format]\nindent_width=4 # Keep the indent.\n';
    const written = parseTomlFile('gspot.toml', source);
    const output = buildSettingsText('', source, written);
    expect(output).toBe(`${SCHEMA_DIRECTIVE}\n${source}`);
    expect(buildSettingsText('', output.slice(SCHEMA_DIRECTIVE.length + 1), written)).toBe(output);
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
    expect(directive).toBe(SCHEMA_DIRECTIVE);
    expect(opening).toBe(PREFACE_BODY.split('\n', 1)[0]);
    expect(result.settings.level).toBe('all');
});

test('setting level keeps a written value equal to its default', async () => {
    await using sandbox = await testdir({
        'gspot.toml': `${SCHEMA_DIRECTIVE}\nconfigurations = ["bash"]\n\n# Keep the chosen format.\n[format]\nprint_width = 120\nindent_width = 4\n`,
    });
    const edit = readSettingsEdit(sandbox.path);
    setKey(edit.table, 'level', 'all');
    const result = buildEditedSettings(sandbox.path, edit);
    expect(result.text).toBe(
        `${SCHEMA_DIRECTIVE}\nconfigurations = ["bash"]\n\nlevel = "all"\n# Keep the chosen format.\n[format]\nprint_width = 120\nindent_width = 4\n`,
    );
});

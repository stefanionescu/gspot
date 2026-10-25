import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { parseTomlText } from '#cli/settings/file.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { SCHEMA_DIRECTIVE } from '#cli/config/settings/file.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { LAYOUT_CASES } from '#tests/config/settings/text/layout.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildInitSettings } from '#cli/commands/init/settings-text.ts';
import { PREFACE_BODY } from '#cli/config/commands/init/settings-text.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';
import { ARRAY_COMMENT_CASES } from '#tests/config/settings/text/array-comments.ts';
import { setKey, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';
import { IGNORE_COMMENT_CASES } from '#tests/config/settings/text/ignore-comments.ts';
import { FIELD_COMMENT_CASES, INLINE_FIELD_COMMENT } from '#tests/config/settings/text/field-comments.ts';

test.each([...IGNORE_COMMENT_CASES, ...ARRAY_COMMENT_CASES, ...FIELD_COMMENT_CASES, ...LAYOUT_CASES])(
    'writing $name gives the same text twice in a row',
    (row) => {
        const { source, expected } = row;
        const target = 'target' in row ? row.target : source;
        const output = buildSettingsText(
            source,
            parseTomlText(target, 'target.toml'),
            settingsSchema.shape.format.parse(parseTomlText(target, 'target.toml')['format']),
        );
        expect(output).toBe(`${SCHEMA_DIRECTIVE}\n${expected}`);
        const parsed = buildSettingsText(
            output,
            parseTomlText(output, 'gspot.toml'),
            settingsSchema.shape.format.parse(parseTomlText(output, 'gspot.toml')['format']),
        );
        expect(parsed).toBe(output);
    },
);
test('setting level keeps the schema directive first and the opening init comment after it', async () => {
    await using sandbox = await testdir();
    const reads = createReadCache(sandbox.path);
    const configurationsByName = readConfigurations();
    const repository = await readRepository(reads, await listRepositoryFiles(reads), {
        generatedPaths: [],
        scopes: [],
        configurationsByName,
    });
    const text = buildInitSettings(
        { configurations: [], scopes: [], hooks: false, ci: 'none', rules: true },
        repository,
        configurationsByName,
    );
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
        `${SCHEMA_DIRECTIVE}\nlevel = "all"\nconfigurations = ["bash"]\n\n# Keep the chosen format.\n[format]\nprint_width = 120\nindent_width = 4\n`,
    );
});
test('a comment on a field in an inline table inside a mixed array cannot be written', () => {
    const written = parseTomlText(INLINE_FIELD_COMMENT, 'gspot.toml');
    expect(() =>
        buildSettingsText(INLINE_FIELD_COMMENT, written, settingsSchema.shape.format.parse(written['format'])),
    ).toThrow('The comment for tools.markdownlint.rules.MD001.mixed.0.enabled cannot be represented in TOML 1.0.');
});

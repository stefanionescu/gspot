import { test, expect } from 'bun:test';
import { getTable } from '#cli/settings/scopes.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseTomlText } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { readRepository } from '#cli/repository/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { SCHEMA_DIRECTIVE } from '#cli/config/settings/file.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { LAYOUT_CASES } from '#tests/config/settings/text/layout.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildRootScopeSettings } from '#tests/setup/cli/settings.ts';
import { buildInitSettings } from '#cli/commands/init/settings-text.ts';
import { DEFAULT_CASES } from '#tests/config/settings/text/defaults.ts';
import { PREFACE_BODY } from '#cli/config/commands/init/settings-text.ts';
import { ARRAY_COMMENT_CASES } from '#tests/config/settings/text/array-comments.ts';
import { setKey, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';
import { IGNORE_COMMENT_CASES } from '#tests/config/settings/text/ignore-comments.ts';
import { FIELD_COMMENT_CASES, INLINE_FIELD_COMMENT } from '#tests/config/settings/text/field-comments.ts';

test.each([...IGNORE_COMMENT_CASES, ...ARRAY_COMMENT_CASES, ...FIELD_COMMENT_CASES, ...DEFAULT_CASES, ...LAYOUT_CASES])(
    'writing $name gives the same text twice in a row',
    (row) => {
        const { source, expected } = row;
        const target = 'target' in row ? row.target : source;
        const output = buildSettingsText(source, parseTomlText(target, 'target.toml'));
        expect(output).toBe(`${SCHEMA_DIRECTIVE}\n${expected}`);
        expect(buildSettingsText(output, parseTomlText(output, 'gspot.toml'))).toBe(output);
    },
);
test('setting level keeps the schema directive first and the opening init comment after it', async () => {
    await using sandbox = await testdir();
    const reads = createReadCache(sandbox.path);
    const configurations = readConfigurations();
    const repository = await readRepository(reads, { generatedPaths: [], scopes: [], configurations });
    const text = buildInitSettings(
        { configurations: [], scopes: [], hooks: false, ci: 'none', rules: true },
        repository,
        configurations,
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
test.each([
    'configurations = ["supabase"]\n[supabase]\nfunctions_folder = "supabase/functions"\n[[scope]]\npath = "apps/api"\n',
    'configurations = ["supabase"]\n[[scope]]\npath = "app"\nsupabase.functions_folder = "supabase/functions"\n[[scope]]\npath = "app/child"\n',
])("dropping defaults keeps every scope's paths the same (%j)", (source) => {
    const before = parseSettings(source, undefined);
    const written = buildSettingsText(source, parseTomlText(source, 'gspot.toml'));
    const after = parseSettings(written, undefined);
    for (const path of ['', ...Object.keys(before.scopes)]) {
        expect(getTable(buildRootScopeSettings(after, path), 'supabase')).toStrictEqual(
            getTable(buildRootScopeSettings(before, path), 'supabase'),
        );
    }
    expect(buildSettingsText(written, parseTomlText(written, 'gspot.toml'))).toBe(written);
});
test('a comment on a field in an inline table inside a mixed array cannot be written', () => {
    const written = parseTomlText(INLINE_FIELD_COMMENT, 'gspot.toml');
    expect(() => buildSettingsText(INLINE_FIELD_COMMENT, written)).toThrow(
        'The comment for tools.markdownlint.rules.MD001.mixed.0.enabled cannot be represented in TOML 1.0.',
    );
});

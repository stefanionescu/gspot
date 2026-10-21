import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { parseTomlText } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import { readRepository } from '#cli/repository/read.ts';
import { PREFACE_BODY } from '#cli/config/commands/init.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { DEFAULT_CASES } from '#tests/data/settings/defaults.ts';
import { buildRootScopeSettings } from '#tests/setup/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildInitSettings } from '#cli/commands/init/settings-text.ts';
import { ARRAY_COMMENT_CASES } from '#tests/data/settings/comments/arrays.ts';
import { FIELD_COMMENT_CASES } from '#tests/data/settings/comments/fields.ts';
import { IGNORE_COMMENT_CASES } from '#tests/data/settings/comments/ignores.ts';
import { LAYOUT_CASES, INLINE_FIELD_COMMENT } from '#tests/data/settings/layout.ts';
import { setKey, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';

test.each([...IGNORE_COMMENT_CASES, ...ARRAY_COMMENT_CASES, ...FIELD_COMMENT_CASES, ...DEFAULT_CASES, ...LAYOUT_CASES])(
    'writing $name gives the same text twice in a row',
    (row) => {
        const { source, expected } = row;
        const target = 'target' in row ? row.target : source;
        const output = buildSettingsText(source, parseTomlText(target, 'target.toml'));
        expect(output).toBe(expected);
        expect(buildSettingsText(output, parseTomlText(output, 'gspot.toml'))).toBe(expected);
    },
);

describe('comments', () => {
    test('setting level keeps the opening init comment on the first line', async () => {
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
        expect(result.text.split('\n', 1)[0]).toBe(PREFACE_BODY.split('\n', 1)[0]);
        expect(result.settings.level).toBe('all');
    });
});
describe('drop-defaults', () => {
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
});
describe('layout', () => {
    test('a comment on a field in an inline table inside a mixed array cannot be written', () => {
        const written = parseTomlText(INLINE_FIELD_COMMENT, 'gspot.toml');
        expect(() => buildSettingsText(INLINE_FIELD_COMMENT, written)).toThrow(
            'The comment for tools.markdownlint.rules.MD001.mixed.0.enabled cannot be represented in TOML 1.0.',
        );
    });
});

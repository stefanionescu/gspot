import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { parseTomlText } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { readRepository } from '#cli/repository/read.ts';
import { PREFACE_BODY } from '#cli/config/commands/init.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { buildScopeView } from '#cli/settings/scope-view.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { DEFAULT_CASES } from '#tests/data/settings/defaults.ts';
import { buildInitSettings } from '#cli/commands/init/settings-text.ts';
import { ARRAY_COMMENT_CASES } from '#tests/data/settings/comments/arrays.ts';
import { FIELD_COMMENT_CASES } from '#tests/data/settings/comments/fields.ts';
import { IGNORE_COMMENT_CASES } from '#tests/data/settings/comments/ignores.ts';
import { setKey, updateSettings, readSettingsEdit } from '#cli/settings/edit.ts';
import { LAYOUT_CASES, INLINE_FIELD_COMMENT } from '#tests/data/settings/layout.ts';

test.each([...IGNORE_COMMENT_CASES, ...ARRAY_COMMENT_CASES, ...FIELD_COMMENT_CASES, ...DEFAULT_CASES, ...LAYOUT_CASES])(
    'writing $name gives the same text twice in a row',
    (row) => {
        const { source, expected } = row;
        const target = 'target' in row ? row.target : source;
        const output = formatSettingsText(source, parseTomlText(target, 'target.toml', 'settings'));
        expect(output).toBe(expected);
        expect(formatSettingsText(output, parseTomlText(output, 'gspot.toml', 'settings'))).toBe(expected);
    },
);

describe('comments', () => {
    test('setting level keeps the opening init comment on the first line', async () => {
        await using sandbox = await testdir();
        const reads = createReadCache(sandbox.path);
        const manifests = readManifests(reads);
        const repository = await readRepository(reads, { declarations: [], scopes: [], manifests });
        const text = buildInitSettings(
            { configurations: [], scopes: [], hooks: false, ci: 'none', rules: true },
            repository,
            manifests,
            new Map(),
        );
        await createFileTree(sandbox.path, { 'gspot.toml': text });
        const result = updateSettings(sandbox.path, readSettingsEdit(sandbox.path), (written) => {
            setKey(written, 'level', 'all');
        });
        expect(result.text.split('\n', 1)[0]).toBe(PREFACE_BODY.split('\n', 1)[0]);
        expect(result.settings.level).toBe('all');
    });
});
describe('drop-defaults', () => {
    test.each([
        'configurations = ["supabase"]\n[supabase]\nfunctions_folder = "supabase/functions"\n[[scope]]\npath = "apps/api"\n',
        'configurations = ["supabase"]\n[[scope]]\npath = "app"\nsupabase.functions_folder = "supabase/functions"\n[[scope]]\npath = "app/child"\n',
    ])("dropping defaults keeps every scope's paths the same (%j)", (source) => {
        const manifests = readManifests(createReadCache(process.cwd()));

        const before = parseSettings(source, undefined, createReadCache(process.cwd()));
        const written = formatSettingsText(source, parseTomlText(source, 'gspot.toml', 'settings'));
        const after = parseSettings(written, undefined, createReadCache(process.cwd()));
        for (const path of ['', ...Object.keys(before.scopes)]) {
            const selected = selectForScope(before, path, manifests);
            const known = buildKnownSettings(selected);
            expect(buildScopeView(known, after, selected, path).options('supabase')).toStrictEqual(
                buildScopeView(known, before, selected, path).options('supabase'),
            );
        }
        expect(formatSettingsText(written, parseTomlText(written, 'gspot.toml', 'settings'))).toBe(written);
    });
});
describe('layout', () => {
    test('a comment on a field in an inline table inside a mixed array cannot be written', () => {
        const written = parseTomlText(INLINE_FIELD_COMMENT, 'gspot.toml', 'settings');
        expect(() => formatSettingsText(INLINE_FIELD_COMMENT, written)).toThrow(
            'The comment for tools.eslint.extra.value.mixed.0.enabled cannot be represented in TOML 1.0.',
        );
    });
});

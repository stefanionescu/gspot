import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { parseTomlText } from '#cli/settings/file.ts';
import { readRepository } from '#cli/repository/read.ts';
import { PREFACE_BODY } from '#cli/config/commands/init.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { initSettingsText } from '#cli/commands/init/settings-text.ts';
import { ARRAY_COMMENT_CASES } from '#tests/config/settings/comments/arrays.ts';
import { FIELD_COMMENT_CASES } from '#tests/config/settings/comments/fields.ts';
import { setKey, updateSettings, readSettingsEdit } from '#cli/settings/edit.ts';
import { IGNORE_COMMENT_CASES } from '#tests/config/settings/comments/ignores.ts';

test.each([...IGNORE_COMMENT_CASES, ...ARRAY_COMMENT_CASES, ...FIELD_COMMENT_CASES])(
    'writing $name gives the same text twice in a row',
    (row) => {
        const { source, expected } = row;
        const target = 'target' in row ? row.target : source;
        const output = formatSettingsText(source, parseTomlText(target, 'target.toml', 'settings'));
        expect(output).toBe(expected);
        expect(formatSettingsText(output, parseTomlText(output, 'gspot.toml', 'settings'))).toBe(expected);
    },
);

test('setting level keeps the opening init comment on the first line', async () => {
    await using sandbox = await testdir();
    const reads = createReadCache(sandbox.path);
    const manifests = readManifests(reads);
    const repository = await readRepository(reads, { declarations: [], scopeEntries: [], manifests });
    const text = initSettingsText(
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

import { test, expect } from 'bun:test';
import { parseTomlText } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { buildScopeView } from '#cli/settings/scope-view.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { DEFAULT_CASES } from '#tests/config/settings/defaults.ts';

test("dropping defaults keeps every scope's paths the same", () => {
    const manifests = readManifests(createReadCache(process.cwd()));
    for (const source of [
        'configurations = ["supabase"]\n[supabase]\nfunctions_folder = "supabase/functions"\n[[scope]]\npath = "apps/api"\n',
        'configurations = ["supabase"]\n[[scope]]\npath = "app"\nsupabase.functions_folder = "supabase/functions"\n[[scope]]\npath = "app/child"\n',
    ]) {
        const before = parseSettings(source, undefined, createReadCache(process.cwd()));
        const written = formatSettingsText(source, parseTomlText(source, 'gspot.toml', 'settings'));
        const after = parseSettings(written, undefined, createReadCache(process.cwd()));
        for (const path of ['', ...Object.keys(before.scope)]) {
            const selected = selectForScope(before, path, manifests);
            const known = buildKnownSettings(selected);
            expect(buildScopeView(known, after, selected, path).options('supabase')).toStrictEqual(
                buildScopeView(known, before, selected, path).options('supabase'),
            );
        }
        expect(formatSettingsText(written, parseTomlText(written, 'gspot.toml', 'settings'))).toBe(written);
    }
});

test.each([...DEFAULT_CASES])('writing $name gives the same text twice in a row', (row) => {
    const { source, expected } = row;
    const output = formatSettingsText(source, parseTomlText(source, 'target.toml', 'settings'));
    expect(output).toBe(expected);
    expect(formatSettingsText(output, parseTomlText(output, 'gspot.toml', 'settings'))).toBe(expected);
});

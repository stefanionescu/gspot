import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/read.ts';
import { selectForScope } from '#cli/repository/select.ts';
import { scopeView, knownSettings } from '#cli/settings/view.ts';
import { DEFAULT_CASES } from '#tests/config/settings/defaults.ts';
import { emitSettings, parseTomlText } from '#cli/settings/file.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

test("dropping defaults keeps every scope's paths the same", () => {
    const manifests = configurationManifests();
    for (const source of [
        'configurations = ["supabase"]\n[supabase]\nfunctions_folder = "supabase/functions"\n[[scope]]\npath = "apps/api"\n',
        'configurations = ["supabase"]\n[[scope]]\npath = "app"\nsupabase.functions_folder = "supabase/functions"\n[[scope]]\npath = "app/child"\n',
    ]) {
        const before = parseSettings(source);
        const written = emitSettings(source, parseTomlText(source, 'gspot.toml', 'settings'));
        const after = parseSettings(written);
        for (const path of ['', ...Object.keys(before.scope)]) {
            const selected = selectForScope(before, path, manifests);
            const known = knownSettings(selected);
            expect(scopeView(known, after, selected, path).options('supabase')).toStrictEqual(
                scopeView(known, before, selected, path).options('supabase'),
            );
        }
        expect(emitSettings(written, parseTomlText(written, 'gspot.toml', 'settings'))).toBe(written);
    }
});

test.each([...DEFAULT_CASES])('writing $name gives the same text twice in a row', (row) => {
    const { source, expected } = row;
    const output = emitSettings(source, parseTomlText(source, 'target.toml', 'settings'));
    expect(output).toBe(expected);
    expect(emitSettings(output, parseTomlText(output, 'gspot.toml', 'settings'))).toBe(expected);
});

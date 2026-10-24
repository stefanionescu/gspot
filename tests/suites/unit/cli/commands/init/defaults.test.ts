import { test, expect } from 'bun:test';
import { getTable } from '#cli/settings/scopes.ts';
import { parseTomlText } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { stripDefaults } from '#cli/commands/init/defaults.ts';
import { SCHEMA_DIRECTIVE } from '#cli/config/settings/file.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { buildRootScopeSettings } from '#tests/setup/cli/settings.ts';
import { DEFAULT_CASES } from '#tests/config/commands/init/defaults.ts';

test.each([...DEFAULT_CASES])('init strips $name without changing inherited values', ({ source, expected }) => {
    const stripped = stripDefaults(parseTomlText(source, 'gspot.toml'));
    const output = buildSettingsText('', stripped);
    expect(output).toBe(`${SCHEMA_DIRECTIVE}\n${expected}`);
    expect(stripDefaults(stripped)).toStrictEqual(stripped);
});

test.each([
    'configurations = ["supabase"]\n[supabase]\nfunctions_folder = "supabase/functions"\n[[scope]]\npath = "apps/api"\n',
    'configurations = ["supabase"]\n[[scope]]\npath = "app"\nsupabase.functions_folder = "supabase/functions"\n[[scope]]\npath = "app/child"\n',
])("dropping defaults keeps every scope's paths the same (%j)", (source) => {
    const before = parseSettings(source, undefined);
    const written = buildSettingsText(source, stripDefaults(parseTomlText(source, 'gspot.toml')));
    const after = parseSettings(written, undefined);
    for (const path of ['', ...Object.keys(before.scopes)]) {
        expect(getTable(buildRootScopeSettings(after, path), 'supabase')).toStrictEqual(
            getTable(buildRootScopeSettings(before, path), 'supabase'),
        );
    }
    expect(buildSettingsText(written, parseTomlText(written, 'gspot.toml'))).toBe(written);
});

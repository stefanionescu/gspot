import { test, expect } from 'bun:test';
import { getTable } from '#cli/settings/scopes.ts';
import { readSettings } from '#cli/settings/read.ts';
import { buildSettingsText } from '#cli/settings/text.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { stripDefaults } from '#cli/commands/init/defaults.ts';
import { SCHEMA_DIRECTIVE } from '#cli/config/settings/text.ts';
import { selectScopeSettings } from '#tests/setup/cli/settings.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { DEFAULT_CASES } from '#tests/config/commands/init/defaults.ts';

test.each([...DEFAULT_CASES])('init strips $name without changing inherited values', ({ source, expected }) => {
    const authored = parseTomlFile('gspot.toml', source);
    const stripped = stripDefaults(authored);
    const output = buildSettingsText('', '', stripped);
    expect(output).toBe(`${SCHEMA_DIRECTIVE}\n${expected}`);
    expect(stripDefaults(stripped)).toStrictEqual(stripped);
});

test.each([
    'configurations = ["supabase"]\n[supabase]\nfunctions_folder = "supabase/functions"\n[[scope]]\npath = "apps/api"\n',
    'configurations = ["supabase"]\n[[scope]]\npath = "app"\nsupabase.functions_folder = "supabase/functions"\n[[scope]]\npath = "app/child"\n',
])("dropping defaults keeps every scope's paths the same (%j)", (source) => {
    using sandbox = createTemporaryFolder();
    const before = readSettings(source, sandbox.path);
    const authored = parseTomlFile('gspot.toml', source);
    const written = buildSettingsText('', source, stripDefaults(authored));
    const after = readSettings(written, sandbox.path);
    for (const path of ['', ...before.scopes.keys()]) {
        expect(getTable(selectScopeSettings(after, path).scopeSettings, 'supabase')).toStrictEqual(
            getTable(selectScopeSettings(before, path).scopeSettings, 'supabase'),
        );
    }
    expect(
        buildSettingsText('', written.slice(SCHEMA_DIRECTIVE.length + 1), parseTomlFile('gspot.toml', written)),
    ).toBe(written);
});

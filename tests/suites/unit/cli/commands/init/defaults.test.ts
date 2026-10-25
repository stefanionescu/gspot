import { test, expect } from 'bun:test';
import { getTable } from '#cli/settings/scopes.ts';
import { parseTomlText } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { stripDefaults } from '#cli/commands/init/defaults.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { SCHEMA_DIRECTIVE } from '#cli/config/settings/file.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { selectScopeSettings } from '#tests/setup/cli/settings.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { DEFAULT_CASES } from '#tests/config/commands/init/defaults.ts';

test.each([...DEFAULT_CASES])('init strips $name without changing inherited values', ({ source, expected }) => {
    const authored = parseTomlText(source, 'gspot.toml');
    const stripped = stripDefaults(authored);
    const output = buildSettingsText('', stripped, settingsSchema.shape.format.parse(authored['format']));
    expect(output).toBe(`${SCHEMA_DIRECTIVE}\n${expected}`);
    expect(stripDefaults(stripped)).toStrictEqual(stripped);
});

test.each([
    'configurations = ["supabase"]\n[supabase]\nfunctions_folder = "supabase/functions"\n[[scope]]\npath = "apps/api"\n',
    'configurations = ["supabase"]\n[[scope]]\npath = "app"\nsupabase.functions_folder = "supabase/functions"\n[[scope]]\npath = "app/child"\n',
])("dropping defaults keeps every scope's paths the same (%j)", (source) => {
    using sandbox = createTemporaryFolder();
    const before = parseSettings(source, sandbox.path);
    const authored = parseTomlText(source, 'gspot.toml');
    const format = settingsSchema.shape.format.parse(authored['format']);
    const written = buildSettingsText(source, stripDefaults(authored), format);
    const after = parseSettings(written, sandbox.path);
    for (const path of ['', ...Object.keys(before.scopes)]) {
        expect(getTable(selectScopeSettings(after, path).scopeSettings, 'supabase')).toStrictEqual(
            getTable(selectScopeSettings(before, path).scopeSettings, 'supabase'),
        );
    }
    expect(buildSettingsText(written, parseTomlText(written, 'gspot.toml'), format)).toBe(written);
});

import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { getTable } from '#cli/settings/scopes.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildSettingsText } from '#cli/settings/text.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { stripDefaults } from '#cli/commands/init/defaults.ts';
import { DEFAULT_CASES } from '#tests/config/commands/init/defaults.ts';

test.each([...DEFAULT_CASES])('init strips $name without changing inherited values', ({ source, expected }) => {
    const authored = parseTomlFile('gspot.toml', source);
    const stripped = stripDefaults(authored);
    const output = buildSettingsText('', '', stripped);
    expect(output).toBe(expected);
    expect(stripDefaults(stripped)).toStrictEqual(stripped);
});

test.each([
    'configurations = ["supabase"]\n[supabase]\nfunctions_folder = "supabase/functions"\n[[scope]]\npath = "apps/api"\n',
    'configurations = ["supabase"]\n[[scope]]\npath = "app"\nsupabase.functions_folder = "supabase/functions"\n[[scope]]\npath = "app/child"\n',
])("dropping defaults keeps every scope's paths the same (%j)", async (source) => {
    await using sandbox = await testdir({ 'gspot.toml': source, 'apps/api/.keep': '', 'app/child/.keep': '' });
    const before = await openSession(sandbox.path);
    const written = buildSettingsText('', source, stripDefaults(parseTomlFile('gspot.toml', source)));
    await writeFile(join(sandbox.path, 'gspot.toml'), written);
    const after = await openSession(sandbox.path);
    expect(after.scopes.map(({ path, settings }) => [path, getTable(settings, 'supabase')])).toStrictEqual(
        before.scopes.map(({ path, settings }) => [path, getTable(settings, 'supabase')]),
    );
    expect(buildSettingsText('', written, parseTomlFile('gspot.toml', written))).toBe(written);
});

import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/read.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { buildSandboxSettings, buildSelectedAvailableSettings } from '#tests/setup/cli/settings.ts';

test("a written false overrides a configuration's true default", () => {
    using sandbox = createTemporaryFolder();
    const availableSettings = buildSelectedAvailableSettings(['postgres']);
    const source = buildSandboxSettings(['postgres'], { rules: true });
    const settings = parseSettings(source, sandbox.path);
    expect(getSettingValue(availableSettings, settings, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: true,
        source: 'configuration postgres',
    });
    const corrected = parseSettings(`${source}[tools.squawk]\nassume_in_transaction = false\n`, sandbox.path);
    expect(getSettingValue(availableSettings, corrected, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: false,
        source: 'gspot.toml',
    });
});

test('an inherited default names the configuration that declares it', () => {
    using sandbox = createTemporaryFolder();
    const availableSettings = buildSelectedAvailableSettings(['supabase']);
    const settings = parseSettings(buildSandboxSettings(['supabase'], { rules: true }), sandbox.path);
    expect(validateKeys(availableSettings, settings, new Map(), buildSelectedAvailableSettings([]))).toStrictEqual([]);
    expect(getSettingValue(availableSettings, settings, 'tools.sqlfluff.dialect')).toMatchObject({
        value: 'postgres',
        source: 'configuration postgres',
    });
});

test('a value comes from the configuration default, then the root table, then the scope table', () => {
    using sandbox = createTemporaryFolder();
    const baseSettings = buildSelectedAvailableSettings(['structure', 'bash', 'naming', 'format', 'prose']);

    const settings = parseSettings(
        buildSandboxSettings(['bash'], {
            rules: true,
            tables: '[limits]\nfile_lines = 250\n[[scope]]\npath = "api"\nlimits.file_lines = 200\n',
        }),
        sandbox.path,
    );
    expect(getSettingValue(baseSettings, settings, 'limits.file_lines')?.value).toBe(250);
    expect(getSettingValue(baseSettings, settings, 'limits.file_lines', 'api')?.value).toBe(200);
    expect(getSettingValue(baseSettings, settings, 'limits.function_lines')?.source).toBe('configuration structure');
});

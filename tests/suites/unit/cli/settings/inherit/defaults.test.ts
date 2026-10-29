import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/planning/session.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { POSTGRES_ORIGIN } from '#tests/config/settings/inherit.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test("a written false overrides a configuration's true default", async () => {
    const source = buildSandboxSettings(['postgres'], { rules: true });
    await using sandbox = await testdir({ 'gspot.toml': source });
    const initial = await openSession(sandbox.path);
    expect(
        getSettingValue(
            initial.scopes[0]!.availableSettings,
            initial.settings,
            'tools.squawk.assume_in_transaction',
            '',
        ),
    ).toMatchObject({ value: true, source: POSTGRES_ORIGIN });
    await writeFile(join(sandbox.path, 'gspot.toml'), `${source}[tools.squawk]\nassume_in_transaction = false\n`);
    const corrected = await openSession(sandbox.path);
    expect(
        getSettingValue(
            corrected.scopes[0]!.availableSettings,
            corrected.settings,
            'tools.squawk.assume_in_transaction',
            '',
        ),
    ).toMatchObject({ value: false, source: 'gspot.toml' });
});

test('an inherited default names the configuration that declares it', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['supabase'], { rules: true }) });
    const { settings, scopes } = await openSession(sandbox.path);
    expect(getSettingValue(scopes[0]!.availableSettings, settings, 'tools.sqlfluff.dialect', '')).toMatchObject({
        value: 'postgres',
        source: POSTGRES_ORIGIN,
    });
});

test('a value comes from the configuration default, then the root table, then the scope table', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], {
            rules: true,
            tables: '[limits]\nfile_lines = 250\n[[scope]]\npath = "api"\nlimits.file_lines = 200\n',
        }),
        'api/run.sh': '',
    });
    const { settings, scopes } = await openSession(sandbox.path);
    const [root, api] = scopes;
    expect(getSettingValue(root!.availableSettings, settings, 'limits.file_lines', '')?.value).toBe(250);
    expect(getSettingValue(api!.availableSettings, settings, 'limits.file_lines', 'api')?.value).toBe(200);
    expect(getSettingValue(root!.availableSettings, settings, 'limits.function_lines', '')?.source).toBe(
        'configuration structure',
    );
});

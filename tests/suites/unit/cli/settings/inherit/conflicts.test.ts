import { test, expect } from 'bun:test';
import { readSettings } from '#cli/settings/read.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import type { AvailableSettings } from '#cli/types/settings.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';

const sqlConfiguration = readConfigurations().get('sql') as Configuration;

const conflictingSettings: AvailableSettings = buildAvailableSettings(
    [
        sqlConfiguration,
        {
            ...sqlConfiguration,
            name: 'alternate-sql',
            defaults: { 'sql.dialect': 'postgres' },
        },
    ],
    'basic',
);

test('two configurations with different defaults are an error until gspot.toml sets the value', () => {
    using sandbox = createTemporaryFolder();

    const source = buildSandboxSettings(['sql'], { rules: true });
    const settings = readSettings(source, sandbox.path);
    expect(validateKeys(conflictingSettings, settings, new Map(), buildAvailableSettings([], 'basic'))).toStrictEqual([
        { path: ['configurations'], message: expect.any(String) as string },
    ]);
    const corrected = readSettings(`${source}[sql]\ndialect = "sqlite"\n`, sandbox.path);
    expect(validateKeys(conflictingSettings, corrected, new Map(), buildAvailableSettings([], 'basic'))).toStrictEqual(
        [],
    );
    expect(getSettingValue(conflictingSettings, corrected, 'sql.dialect', '')).toMatchObject({
        value: 'sqlite',
        source: 'gspot.toml',
    });
});

test('the conflict is reported at the scope that selects both configurations', () => {
    using sandbox = createTemporaryFolder();

    const settings = readSettings(
        buildSandboxSettings([], { rules: true, scopes: [{ path: 'db', configurations: ['sql'] }] }),
        sandbox.path,
    );
    expect(
        validateKeys(
            buildAvailableSettings([], 'basic'),
            settings,
            new Map([['db', conflictingSettings]]),
            buildAvailableSettings([], 'basic'),
        ),
    ).toStrictEqual([{ path: ['scope', 0, 'configurations'], message: expect.any(String) as string }]);
});

test('a scope value settles the scopes below it, and a sibling scope still reports the conflict', () => {
    using sandbox = createTemporaryFolder();

    const settings = readSettings(
        buildSandboxSettings([], {
            rules: true,
            tables: '\n[[scope]]\npath = "app"\nconfigurations = ["sql"]\nsql.dialect = "sqlite"\n[[scope]]\npath = "app/db"\nconfigurations = ["sql"]\n[[scope]]\npath = "other"\nconfigurations = ["sql"]\n',
        }),
        sandbox.path,
    );
    const scopes = new Map(settings.scopes.keys().map((path) => [path, conflictingSettings]));
    expect(
        validateKeys(buildAvailableSettings([], 'basic'), settings, scopes, buildAvailableSettings([], 'basic')),
    ).toStrictEqual([{ path: ['scope', 2, 'configurations'], message: expect.any(String) as string }]);
    expect(getSettingValue(conflictingSettings, settings, 'sql.dialect', 'app/db')).toMatchObject({
        value: 'sqlite',
        source: 'scope app',
    });
});

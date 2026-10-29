import { test, expect } from 'bun:test';
import { readSettings } from '#cli/settings/read.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { type AvailableSettings } from '#cli/types/settings/inheritance.ts';
import { CONFLICTING_DEFAULT_ERRORS } from '#tests/config/settings/inherit.ts';
import { buildSandboxSettings, buildSelectedAvailableSettings } from '#tests/setup/cli/settings.ts';

const sqlConfiguration = readConfigurations().get('sql') as Configuration;

const conflictingSettings: AvailableSettings = buildAvailableSettings(
    [
        sqlConfiguration,
        {
            ...sqlConfiguration,
            name: 'alternate-sql',
            defaults: { 'tools.sqlfluff.dialect': 'postgres' },
        },
    ],
    'basic',
);

test('two configurations with different defaults are an error until gspot.toml sets the value', () => {
    using sandbox = createTemporaryFolder();

    const source = buildSandboxSettings(['sql'], { rules: true });
    const settings = readSettings(source, sandbox.path);
    expect(validateKeys(conflictingSettings, settings, new Map(), buildSelectedAvailableSettings([]))).toStrictEqual([
        ...CONFLICTING_DEFAULT_ERRORS,
    ]);
    const corrected = readSettings(`${source}[tools.sqlfluff]\ndialect = "sqlite"\n`, sandbox.path);
    expect(validateKeys(conflictingSettings, corrected, new Map(), buildSelectedAvailableSettings([]))).toStrictEqual(
        [],
    );
    expect(getSettingValue(conflictingSettings, corrected, 'tools.sqlfluff.dialect', '')).toMatchObject({
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
            buildSelectedAvailableSettings([]),
            settings,
            new Map([['db', conflictingSettings]]),
            buildSelectedAvailableSettings([]),
        ),
    ).toStrictEqual([{ path: ['scope', 0, 'configurations'], message: conflictingSettings.errors[0]!.message }]);
});

test('a scope value settles the scopes below it, and a sibling scope still reports the conflict', () => {
    using sandbox = createTemporaryFolder();

    const settings = readSettings(
        buildSandboxSettings([], {
            rules: true,
            tables: '\n[[scope]]\npath = "app"\nconfigurations = ["sql"]\ntools.sqlfluff.dialect = "sqlite"\n[[scope]]\npath = "app/db"\nconfigurations = ["sql"]\n[[scope]]\npath = "other"\nconfigurations = ["sql"]\n',
        }),
        sandbox.path,
    );
    const scopes = new Map([...settings.scopes.keys()].map((path) => [path, conflictingSettings]));
    expect(
        validateKeys(buildSelectedAvailableSettings([]), settings, scopes, buildSelectedAvailableSettings([])),
    ).toStrictEqual([{ path: ['scope', 2, 'configurations'], message: conflictingSettings.errors[0]!.message }]);
    expect(getSettingValue(conflictingSettings, settings, 'tools.sqlfluff.dialect', 'app/db')).toMatchObject({
        value: 'sqlite',
        source: '[scope "app"]',
    });
});

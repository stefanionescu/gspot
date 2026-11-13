import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { readConfigurations } from '#cli/manifests/read.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { AvailableSettings } from '#cli/types/settings.ts';
import { INVALID_MARKDOWNLINT_NAMES, SCOPE_CONFIGURATION_SETTINGS } from '#tests/config/settings/parse.ts';
import { SETTING_RULE_OPTIONS } from '#tests/config/settings/validation.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

const sqlConfiguration = readConfigurations().get('sql') as Configuration;

const conflictingSettings: AvailableSettings = buildAvailableSettings(
    [sqlConfiguration, { ...sqlConfiguration, name: 'alternate-sql', defaults: { 'sql.dialect': 'postgres' } }],
    'basic',
);

const CONFLICT_MESSAGE =
    'The configurations sql and alternate-sql set sql.dialect to different values. Set it yourself in gspot.toml to decide.';

test.each(INVALID_MARKDOWNLINT_NAMES)('markdownlint refuses $name at its rule key', ({ name, value }) => {
    expect(
        validateSettingsText(
            stringify({ configurations: ['markdown'], tools: { markdownlint: { rules: { [name]: value } } } }),
        ),
    ).toStrictEqual([
        `gspot.toml:4: tools.markdownlint.rules.${name}: Name a rule by its ID, such as MD024 = { siblings_only = false }. This table holds rule options only.`,
    ]);
});

test('a licenses table with no licenses configuration stops with the command that adds it', () => {
    const text = '[licenses]\nallowed = ["MIT"]\n';
    expect(validateSettingsText(text)).toStrictEqual([
        'gspot.toml:2: licenses.allowed: licenses.allowed belongs to licenses, which no scope selects. Run gspot add licenses.',
    ]);
    expect(validateSettingsText(`configurations = ["licenses"]\n${text}`)).toStrictEqual([]);
});

test('the release age can be written at the root and cannot be written in a scope', () => {
    expect(validateSettingsText('[dependencies]\nmin_release_age_days = 30\n')).toStrictEqual([]);
    expect(
        validateSettingsText('[[scope]]\npath = "api"\n[scope.dependencies]\nmin_release_age_days = 30\n'),
    ).toStrictEqual([
        expect.stringMatching(
            /^gspot\.toml:4: scope\.0\.dependencies\.min_release_age_days: There is no setting called dependencies\.min_release_age_days\./u,
        ) as string,
    ]);
});

test.each([
    { text: '[ci]\nenable = true\n', where: 'gspot.toml:2: ci.enable: ', suggestion: 'Did you mean ci.enabled?' },
    {
        text: '[tools.markdownlnt]\nrules = {}\n',
        where: 'gspot.toml:1: tools.markdownlnt: ',
        suggestion: 'Did you mean markdownlint?',
    },
])('an unknown key under $text names the closest key or table that exists', ({ text, where, suggestion }) => {
    const errors = validateSettingsText(text);
    expect(errors).toStrictEqual([expect.stringContaining(suggestion) as string]);
    expect(errors[0]).toStartWith(where);
});

test.each([...SCOPE_CONFIGURATION_SETTINGS])('$name', ({ text, errors: starts }) => {
    const errors = validateSettingsText(text);
    expect(errors).toHaveLength(starts.length);
    for (const [index, start] of starts.entries()) expect(errors[index]).toStartWith(start);
});

test.each(['ordinary', 'constructor'])(
    'rule keys named like object properties are checked like any other key (%j)',
    (key) => {
        const errors = validateSettingsText(
            `configurations = ["commits"]\n[tools.commitlint.rules]\n"${key}" = ["invalid"]\n`,
        );
        expect(errors).toHaveLength(1);
        expect(errors[0]).toStartWith(
            `gspot.toml:3: tools.commitlint.rules.${key}: There is no commitlint rule called ${key}.`,
        );
    },
);

test('tools.commitlint.rules refuses type-enum and names commits.types', () => {
    const text = 'configurations = ["commits"]\n[tools.commitlint.rules]\ntype-enum = ["always", ["feat"]]\n';
    expect(validateSettingsText(text)).toStrictEqual([
        'gspot.toml:3: tools.commitlint.rules.type-enum: Set commits.types instead.',
    ]);
});

test.each([...SETTING_RULE_OPTIONS])('options for $rule are refused with $setting', ({ tables, setting, start }) => {
    const errors = validateSettingsText('configurations = ["javascript", "markdown"]\n' + tables);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toStartWith(start);
    expect(errors[0]).toContain(setting);
});

test('a rule named constructor is not mistaken for a setting-owned rule', () => {
    expect(
        validateSettingsText('configurations = ["javascript"]\n[tools.eslint.rules]\n"constructor" = [{}]\n'),
    ).toStrictEqual([]);
});

test('two configurations with different defaults are an error until gspot.toml sets the value', () => {
    using sandbox = createTemporaryFolder();
    const source = buildSandboxSettings(['sql'], { rules: true });
    const settings = parseSettings(source, sandbox.path);
    expect(validateKeys(conflictingSettings, settings, new Map(), buildAvailableSettings([], 'basic'))).toStrictEqual([
        { path: ['configurations'], message: CONFLICT_MESSAGE },
    ]);
    const corrected = parseSettings(`${source}[sql]\ndialect = "sqlite"\n`, sandbox.path);
    expect(validateKeys(conflictingSettings, corrected, new Map(), buildAvailableSettings([], 'basic'))).toStrictEqual(
        [],
    );
    expect(getSettingValue(conflictingSettings, corrected, 'sql.dialect', '')).toMatchObject({
        value: 'sqlite',
        origin: { kind: 'root', name: 'gspot.toml' },
    });
});

test('the conflict is reported at the scope that selects both configurations', () => {
    using sandbox = createTemporaryFolder();
    const settings = parseSettings(
        buildSandboxSettings([], { rules: true, scopes: [{ path: 'db', configurations: ['sql'] }] }),
        sandbox.path,
    );
    const scopes = new Map([['db', conflictingSettings]]);
    expect(
        validateKeys(buildAvailableSettings([], 'basic'), settings, scopes, buildAvailableSettings([], 'basic')),
    ).toStrictEqual([{ path: ['scope', 0, 'configurations'], message: CONFLICT_MESSAGE }]);
});

test('a scope value settles the scopes below it, and a sibling scope still reports the conflict', () => {
    using sandbox = createTemporaryFolder();
    const settings = parseSettings(
        buildSandboxSettings([], {
            rules: true,
            tables: '\n[[scope]]\npath = "app"\nconfigurations = ["sql"]\nsql.dialect = "sqlite"\n[[scope]]\npath = "app/db"\nconfigurations = ["sql"]\n[[scope]]\npath = "other"\nconfigurations = ["sql"]\n',
        }),
        sandbox.path,
    );
    const scopes = new Map(settings.scopes.keys().map((path) => [path, conflictingSettings]));
    expect(
        validateKeys(buildAvailableSettings([], 'basic'), settings, scopes, buildAvailableSettings([], 'basic')),
    ).toStrictEqual([{ path: ['scope', 2, 'configurations'], message: CONFLICT_MESSAGE }]);
    expect(getSettingValue(conflictingSettings, settings, 'sql.dialect', 'app/db')).toMatchObject({
        value: 'sqlite',
        origin: { kind: 'scope', name: 'app' },
    });
});

test('limits that no check reads are refused', () => {
    const errors = validateSettingsText(
        buildSandboxSettings(['sql', 'bash'], {
            rules: true,
            tables: '[limits.sql]\nmax_function_lines = 60\n[limits.bash]\nmax_cyclomatic_complexity = 8\n',
        }),
    );
    expect(errors).toHaveLength(2);
    expect(errors[0]).toStartWith(
        'gspot.toml:5: limits.bash.max_cyclomatic_complexity: There is no setting called limits.bash.max_cyclomatic_complexity.',
    );
    expect(errors[1]).toBe(
        'gspot.toml:3: limits.sql.max_function_lines: There is no setting called limits.sql.max_function_lines. Did you mean limits.sql.max_file_lines?',
    );
});

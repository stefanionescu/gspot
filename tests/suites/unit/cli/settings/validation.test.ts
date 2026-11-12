import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { readConfigurations } from '#cli/manifests/read.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { readSettings } from '#cli/settings/read.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { AvailableSettings } from '#cli/types/settings.ts';
import {
    BOUNDARY_IMPORT_RULES,
    INVALID_SETTING_LOCATIONS,
    ORDERED_IMPORT_RULES,
    REFUSED_RULE_OPTIONS,
    REFUSED_SCOPE_PATHS,
    SETTING_RULE_OPTIONS,
    SWIFT_TARGET_REASON_CASES,
} from '#tests/config/settings/validation.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

const sqlConfiguration = readConfigurations().get('sql') as Configuration;

const conflictingSettings: AvailableSettings = buildAvailableSettings(
    [sqlConfiguration, { ...sqlConfiguration, name: 'alternate-sql', defaults: { 'sql.dialect': 'postgres' } }],
    'basic',
);

const CONFLICT_MESSAGE =
    'The configurations sql and alternate-sql set sql.dialect to different values. Set it yourself in gspot.toml to decide.';

test.each([...INVALID_SETTING_LOCATIONS])('settings errors locate $name', ({ text, where }) => {
    expect(validateSettingsText(text)).toStrictEqual([where]);
});

test('can_import names only declared rules', () => {
    expect(
        validateSettingsText(BOUNDARY_IMPORT_RULES.replace('can_import = ["storage"]', 'can_import = ["missing"]')),
    ).toStrictEqual(['gspot.toml:8: import_rule.1.can_import.0: There is no import rule called missing.']);
});

test('an import rule refuses a leading ! and accepts an extglob', () => {
    using sandbox = createTemporaryFolder();
    const refused = ORDERED_IMPORT_RULES.replace('["app/**"]', '["app/**", "!app/generated.ts"]');
    expect(validateSettingsText(refused)).toStrictEqual([
        'gspot.toml:7: import_rule.1.paths.1: The import rule app cannot exclude !app/generated.ts. Put a narrower rule for those files first, and list what it may import in can_import.',
    ]);
    const extglobs = ['app/!(procedures).*', '!(procedures)/**'];
    const text = ORDERED_IMPORT_RULES.replace('["app/**"]', () => JSON.stringify(extglobs));
    const settings = readSettings(text, sandbox.path);
    expect(settings.import_rule[1]?.paths).toStrictEqual(extglobs);
});

test('an ignore without check needs paths and takes no rule', () => {
    using sandbox = createTemporaryFolder();
    const reason = 'Product photos and facts are data, not code.';
    const settings = readSettings(`[[ignore]]\npaths = ["assets/products/**"]\nreason = "${reason}"\n`, sandbox.path);
    expect(settings.ignore).toStrictEqual([{ paths: ['assets/products/**'], reason }]);
    expect(validateSettingsText(`[[ignore]]\nreason = "${reason}"\n`)).toStrictEqual([
        'gspot.toml:1: ignore.0.paths: An ignore without check needs paths.',
    ]);
    expect(
        validateSettingsText(`[[ignore]]\nrule = "no-console"\npaths = ["a/**"]\nreason = "${reason}"\n`),
    ).toStrictEqual([
        'gspot.toml:2: ignore.0.rule: An ignore without check cannot name a rule. Add the check that owns the rule.',
    ]);
});

test.each([...REFUSED_SCOPE_PATHS])('scope refuses the path %j', (path, guidance) => {
    const errors = validateSettingsText(stringify({ scope: [{ path }] }));
    expect(new Set(errors)).toStrictEqual(
        new Set([
            `gspot.toml:2: scope.0.path: The value ${JSON.stringify(path)} is not valid for scope.0.path. ${guidance}`,
        ]),
    );
});

test('relative folders with spaces, percent signs and Unicode are accepted', async () => {
    const path = 'apps/café 100%';
    await using sandbox = await testdir({ [`${path}/source.ts`]: 'export const count = 1;\n' });

    const settings = readSettings(stringify({ scope: [{ path }] }), sandbox.path)
        .scopes.keys()
        .toArray();
    expect(settings).toStrictEqual([path]);
});

test.each(['ordinary', 'constructor'])(
    'rule keys named like object properties are checked like any other key (%j)',
    (key) => {
        expect(
            validateSettingsText(`configurations = ["commits"]\n[tools.commitlint.rules]\n"${key}" = ["invalid"]\n`),
        ).toStrictEqual([
            `gspot.toml:3: tools.commitlint.rules.${key}: There is no commitlint rule called ${key}. The commitlint rules are type-case, type-empty, scope-case, subject-empty, subject-full-stop, subject-case, header-max-length, body-leading-blank, body-max-line-length, footer-leading-blank.`,
        ]);
    },
);

test.each([
    { rule: 'type-enum', setting: 'commits.types' },
    { rule: 'scope-enum', setting: 'commits.scopes' },
])('tools.commitlint.rules refuses $rule and names $setting', ({ rule, setting }) => {
    const text = `configurations = ["commits"]\n[tools.commitlint.rules]\n${rule} = ["always", ["feat"]]\n`;
    expect(validateSettingsText(text)).toStrictEqual([
        `gspot.toml:3: tools.commitlint.rules.${rule}: Set ${setting} instead.`,
    ]);
});

test.each([...REFUSED_RULE_OPTIONS])(
    '$tool rule settings refuse a severity with one line that names gspot ignore: $toml',
    ({ configuration, toml, where }) => {
        const text = buildSandboxSettings([configuration], { rules: true, tables: toml });
        expect(validateSettingsText(text)).toStrictEqual([where]);
    },
);

test.each([...SETTING_RULE_OPTIONS])('options for $rule are refused with $setting', ({ tables, where }) => {
    expect(validateSettingsText('configurations = ["javascript", "markdown"]\n' + tables)).toStrictEqual([where]);
});

test('a rule named constructor is not mistaken for a setting-owned rule', () => {
    expect(
        validateSettingsText('configurations = ["javascript"]\n[tools.eslint.rules]\n"constructor" = [{}]\n'),
    ).toStrictEqual([]);
});

test('the freeze cutoff refuses a word that is not none, all, or a version', () => {
    expect(
        validateSettingsText('configurations = ["postgres"]\n[postgres]\nfrozen_through = "latest"\n'),
    ).toStrictEqual([
        'gspot.toml:3: postgres.frozen_through: The value "latest" is not valid for postgres.frozen_through. Use a valid string value: The last migration version that has run everywhere (none, all, or a version); Squawk and the grants check skip those migrations.',
    ]);
});

test.each(SWIFT_TARGET_REASON_CASES)('a Swift target validates $name', ({ lines, reason, errors }) => {
    const text = `configurations = ["swift"]\n[coverage]\nmin_line_percent = 80\n[[coverage.swift_target]]\nname = "App"\nmin_line_percent = ${String(lines)}${reason}\n`;
    expect(validateSettingsText(text)).toStrictEqual([...errors]);
});

test('a scope path that names a file is refused', async () => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    expect(validateSettingsText('[[scope]]\npath = "README.md"\n', sandbox.path)).toStrictEqual([
        'gspot.toml:2: scope.0.path: The scope README.md names a file. Name a folder under the repository root.',
    ]);
});

test('a rule file path that names a folder is refused', async () => {
    await using sandbox = await testdir({ rules: {} });
    expect(validateSettingsText('[security]\nsemgrep_rules = ["rules"]\n', sandbox.path)).toStrictEqual([
        'gspot.toml:2: security.semgrep_rules.0: rules names no file. Point semgrep_rules at a file, relative to its table.',
    ]);
});

test('a Stylelint plugin path that names no file is refused', async () => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    expect(
        validateSettingsText(
            'configurations = ["css"]\n[[tools.stylelint.plugins]]\npath = "tools/missing.mjs"\nrules = {}\n',
            sandbox.path,
        ),
    ).toStrictEqual([
        'gspot.toml:3: tools.stylelint.plugins.0.path: tools/missing.mjs names no file. Point path at a file, relative to its table.',
    ]);
});

test('two configurations with different defaults are an error until gspot.toml sets the value', () => {
    using sandbox = createTemporaryFolder();
    const source = buildSandboxSettings(['sql'], { rules: true });
    const settings = readSettings(source, sandbox.path);
    expect(validateKeys(conflictingSettings, settings, new Map(), buildAvailableSettings([], 'basic'))).toStrictEqual([
        { path: ['configurations'], message: CONFLICT_MESSAGE },
    ]);
    const corrected = readSettings(`${source}[sql]\ndialect = "sqlite"\n`, sandbox.path);
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
    const settings = readSettings(
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
    ).toStrictEqual([{ path: ['scope', 2, 'configurations'], message: CONFLICT_MESSAGE }]);
    expect(getSettingValue(conflictingSettings, settings, 'sql.dialect', 'app/db')).toMatchObject({
        value: 'sqlite',
        origin: { kind: 'scope', name: 'app' },
    });
});

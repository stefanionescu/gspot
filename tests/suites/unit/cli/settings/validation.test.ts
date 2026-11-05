import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { listAllowedRules } from '#cli/settings/import-rules.ts';
import { readSettings } from '#cli/settings/read.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
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

test.each([...INVALID_SETTING_LOCATIONS])('settings errors locate $name', ({ text, where }) => {
    expect(validateSettingsText(text)).toStrictEqual([where]);
});

test('an import rule may import the rules above it, and a rule below is refused', () => {
    using sandbox = createTemporaryFolder();
    const settings = readSettings(ORDERED_IMPORT_RULES, sandbox.path);
    expect(settings.import_rule).toStrictEqual([
        { name: 'storage', paths: ['storage/**'] },
        { name: 'app', paths: ['app/**'] },
        { name: 'entry', paths: ['entry/**'] },
    ]);
    expect(listAllowedRules(settings.import_rule, 1)).toStrictEqual(['app', 'storage']);
    expect(validateSettingsText(ORDERED_IMPORT_RULES.replace('paths = ["app/**"]', 'paths = [3]'))).toStrictEqual([
        'gspot.toml:7: import_rule.1.paths.0',
    ]);
});

test('can_import lists exact rules and names only declared rules', () => {
    using sandbox = createTemporaryFolder();
    const settings = readSettings(BOUNDARY_IMPORT_RULES, sandbox.path);
    expect(settings.import_rule[1]).toStrictEqual({
        name: 'app',
        paths: ['app/**'],
        can_import: ['storage'],
    });
    expect(
        validateSettingsText(BOUNDARY_IMPORT_RULES.replace('can_import = ["storage"]', 'can_import = ["missing"]')),
    ).toStrictEqual(['gspot.toml:8: import_rule.1.can_import.0']);
});

test('an import rule refuses a leading ! and accepts an extglob', () => {
    using sandbox = createTemporaryFolder();
    const refused = ORDERED_IMPORT_RULES.replace('["app/**"]', '["app/**", "!app/generated.ts"]');
    expect(validateSettingsText(refused)).toStrictEqual(['gspot.toml:7: import_rule.1.paths.1']);
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
    expect(validateSettingsText(`[[ignore]]\nreason = "${reason}"\n`)).toStrictEqual(['gspot.toml:1: ignore.0.paths']);
    expect(
        validateSettingsText(`[[ignore]]\nrule = "no-console"\npaths = ["a/**"]\nreason = "${reason}"\n`),
    ).toStrictEqual(['gspot.toml:2: ignore.0.rule']);
});

test.each([...REFUSED_SCOPE_PATHS])('scope refuses the path %j', (path) => {
    const locations = validateSettingsText(stringify({ scope: [{ path }] }));
    expect(new Set(locations)).toStrictEqual(new Set(['gspot.toml:2: scope.0.path']));
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
        ).toStrictEqual([`gspot.toml:3: tools.commitlint.rules.${key}`]);
    },
);

test.each([
    { table: 'limits', key: 'limits.min_function_statements', renamed: 'limits.trivial_function_statements' },
    {
        table: 'limits.python',
        key: 'limits.python.min_function_statements',
        renamed: 'limits.python.trivial_function_statements',
    },
])('$key names $renamed', ({ table, key, renamed }) => {
    using sandbox = createTemporaryFolder();
    const text = `[${table}]\nmin_function_statements = 3\n`;
    expect(validateSettingsText(text)).toStrictEqual([`gspot.toml:2: ${key}`]);
    expect(() => readSettings(text, sandbox.path)).toThrow(`${key} is now ${renamed}, with the same value.`);
});

test.each([
    { rule: 'type-enum', setting: 'commits.types' },
    { rule: 'scope-enum', setting: 'commits.scopes' },
])('tools.commitlint.rules refuses $rule and names $setting', ({ rule, setting }) => {
    using sandbox = createTemporaryFolder();
    const text = `configurations = ["commits"]\n[tools.commitlint.rules]\n${rule} = ["always", ["feat"]]\n`;
    expect(validateSettingsText(text)).toStrictEqual([`gspot.toml:3: tools.commitlint.rules.${rule}`]);
    expect(() => readSettings(text, sandbox.path)).toThrow(`Set ${setting} instead.`);
});

test.each([...REFUSED_RULE_OPTIONS])(
    '$tool rule settings refuse a severity with one line that names gspot ignore: $toml',
    ({ configuration, toml, where, command }) => {
        using sandbox = createTemporaryFolder();
        const text = buildSandboxSettings([configuration], { rules: true, tables: toml });
        expect(validateSettingsText(text)).toStrictEqual([where]);
        expect(() => readSettings(text, sandbox.path)).toThrow(command);
    },
);

test.each([...SETTING_RULE_OPTIONS])(
    'options for $rule are refused with $setting',
    ({ tables, path, line, setting }) => {
        using sandbox = createTemporaryFolder();
        const text = 'configurations = ["javascript", "markdown"]\n' + tables;
        expect(validateSettingsText(text)).toStrictEqual([`gspot.toml:${String(line)}: ${path}`]);
        expect(() => readSettings(text, sandbox.path)).toThrow(`gspot set ${setting} `);
    },
);

test('a rule named constructor is not mistaken for a setting-owned rule', () => {
    expect(
        validateSettingsText('configurations = ["javascript"]\n[tools.eslint.rules]\n"constructor" = [{}]\n'),
    ).toStrictEqual([]);
});

test.each(['latest'])('the freeze cutoff refuses an invalid version: %s', (through) => {
    expect(
        validateSettingsText(`configurations = ["postgres"]\n[postgres]\nfrozen_through = "${through}"\n`),
    ).toStrictEqual(['gspot.toml:3: postgres.frozen_through']);
});

test.each(SWIFT_TARGET_REASON_CASES)('a Swift target validates $name', ({ lines, reason, errors }) => {
    const text = `configurations = ["swift"]\n[coverage]\nmin_line_percent = 80\n[[coverage.swift_target]]\nname = "App"\nmin_line_percent = ${String(lines)}${reason}\n`;
    expect(validateSettingsText(text)).toStrictEqual([...errors]);
});

test('a scope path that names a file is refused', async () => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    expect(validateSettingsText('[[scope]]\npath = "README.md"\n', sandbox.path)).toStrictEqual([
        'gspot.toml:2: scope.0.path',
    ]);
});

test('a rule file path that names a folder is refused', async () => {
    await using sandbox = await testdir({ rules: {} });
    expect(validateSettingsText('[security]\nsemgrep_rules = ["rules"]\n', sandbox.path)).toStrictEqual([
        'gspot.toml:2: security.semgrep_rules.0',
    ]);
});

test('a Stylelint plugin path that names no file is refused', async () => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    expect(
        validateSettingsText(
            'configurations = ["css"]\n[[tools.stylelint.plugins]]\npath = "tools/missing.mjs"\nrules = {}\n',
            sandbox.path,
        ),
    ).toStrictEqual(['gspot.toml:3: tools.stylelint.plugins.0.path']);
});

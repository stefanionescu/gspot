import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { readSettings } from '#cli/settings/read.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { listAllowedRules } from '#cli/settings/import-rules.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

import {
    UNSAFE_SCOPE_PATHS,
    ORDERED_IMPORT_RULES,
    REFUSED_RULE_OPTIONS,
    SETTING_RULE_OPTIONS,
    REFUSED_SCOPE_FOLDERS,
    BOUNDARY_IMPORT_RULES,
    INVALID_SETTING_MESSAGES,
    SWIFT_TARGET_REASON_CASES,
} from '#tests/config/settings/validation.ts';

test.each([...INVALID_SETTING_MESSAGES])('settings errors locate $name', ({ text, message }) => {
    using sandbox = createTemporaryFolder();
    expect(() => readSettings(text, sandbox.path)).toThrow(
        matchFields<GspotError>({ name: 'GspotError', code: 'settings', message }),
    );
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
    expect(() => readSettings(ORDERED_IMPORT_RULES.replace('paths = ["app/**"]', 'paths = [3]'), sandbox.path)).toThrow(
        'import_rule.1.paths.0',
    );
});

test('can_import lists exact rules and names only declared rules', () => {
    using sandbox = createTemporaryFolder();
    const settings = readSettings(BOUNDARY_IMPORT_RULES, sandbox.path);
    expect(settings.import_rule[1]).toStrictEqual({
        name: 'app',
        paths: ['app/**'],
        can_import: ['storage'],
    });
    expect(() =>
        readSettings(
            BOUNDARY_IMPORT_RULES.replace('can_import = ["storage"]', 'can_import = ["missing"]'),
            sandbox.path,
        ),
    ).toThrow('import_rule.1.can_import.0: There is no import rule called missing.');
});

test('an import rule refuses a leading ! and accepts an extglob', () => {
    using sandbox = createTemporaryFolder();
    const refused = ORDERED_IMPORT_RULES.replace('["app/**"]', '["app/**", "!app/generated.ts"]');
    expect(() => readSettings(refused, sandbox.path)).toThrow(
        'gspot.toml:7: import_rule.1.paths.1: The import rule app cannot exclude !app/generated.ts. Put a narrower rule for those files first, and list what it may import in can_import.',
    );
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
    expect(() => readSettings(`[[ignore]]\nreason = "${reason}"\n`, sandbox.path)).toThrow(
        'An ignore without check needs paths.',
    );
    expect(() =>
        readSettings(`[[ignore]]\nrule = "no-console"\npaths = ["a/**"]\nreason = "${reason}"\n`, sandbox.path),
    ).toThrow('An ignore without check cannot name a rule.');
});

test.each([...UNSAFE_SCOPE_PATHS])('scope refuses the path %s', (path) => {
    using sandbox = createTemporaryFolder();
    expect(() => readSettings(stringify({ scope: [{ path }] }), sandbox.path)).toThrow(
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    );
});

test.each([...REFUSED_SCOPE_FOLDERS])('scope refuses the folder $path', ({ path, message }) => {
    using sandbox = createTemporaryFolder();
    expect(() => readSettings(stringify({ scope: [{ path }] }), sandbox.path)).toThrow(message);
});

test('relative folders with spaces, percent signs and Unicode are accepted', async () => {
    const path = 'apps/café 100%';
    await using sandbox = await testdir({ [`${path}/source.ts`]: 'export const count = 1;\n' });

    const settings = readSettings(stringify({ scope: [{ path }] }), sandbox.path)
        .scopes.keys()
        .toArray();
    expect(settings).toStrictEqual([path]);
});

test('zero and false tool options are kept as values', () => {
    using sandbox = createTemporaryFolder();
    const settings = readSettings(
        stringify({
            configurations: ['javascript'],
            tools: { eslint: { rules: { 'id-length': [{ min: 0, properties: false }] } } },
        }),
        sandbox.path,
    );
    expect(settings.tools).toMatchObject({ eslint: { rules: { 'id-length': [{ min: 0, properties: false }] } } });
});

test.each(['ordinary', 'constructor'])(
    'rule keys named like object properties are checked like any other key (%j)',
    (key) => {
        using sandbox = createTemporaryFolder();
        expect(() =>
            readSettings(
                `configurations = ["commits"]\n[tools.commitlint.rules]\n"${key}" = ["invalid"]\n`,
                sandbox.path,
            ),
        ).toThrow(`tools.commitlint.rules.${key}: There is no commitlint rule called`);
    },
);

test.each([...REFUSED_RULE_OPTIONS])(
    '$tool rule settings refuse a severity with one line that names gspot ignore: $toml',
    ({ configuration, toml, message }) => {
        expect(
            validateSettingsText(buildSandboxSettings([configuration], { rules: true, tables: toml })),
        ).toStrictEqual([message]);
    },
);

test.each([...SETTING_RULE_OPTIONS])(
    'options for $rule are refused with $setting',
    ({ tables, path, line, rule, setting }) => {
        using sandbox = createTemporaryFolder();
        expect(() => readSettings('configurations = ["javascript", "markdown"]\n' + tables, sandbox.path)).toThrow(
            `gspot.toml:${String(line)}: ${path}: gspot writes the options of ${rule} from ${setting}. Change that setting instead: gspot set ${setting} <value>, with --reason when you raise it.`,
        );
    },
);

test('a rule named constructor is not mistaken for a setting-owned rule', () => {
    expect(
        validateSettingsText('configurations = ["javascript"]\n[tools.eslint.rules]\n"constructor" = [{}]\n'),
    ).toStrictEqual([]);
});

test.each(['latest'])('the freeze cutoff refuses an invalid version: %s', (through) => {
    using sandbox = createTemporaryFolder();
    expect(() =>
        readSettings(`configurations = ["postgres"]\n[postgres]\nfrozen_through = "${through}"\n`, sandbox.path),
    ).toThrow(
        `gspot.toml:3: postgres.frozen_through: The value "${through}" is not valid for postgres.frozen_through. Use a valid string value: `,
    );
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

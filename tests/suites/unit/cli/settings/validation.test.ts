import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import { parseTomlText } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { listAllowedRules } from '#cli/settings/import-rules.ts';
import { REVIEWED_REASON } from '#tests/config/settings/samples.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

import {
    UNTIL_DATE_CASES,
    UNSAFE_SCOPE_PATHS,
    ORDERED_IMPORT_RULES,
    REFUSED_RULE_OPTIONS,
    SETTING_RULE_OPTIONS,
    BOUNDARY_IMPORT_RULES,
    INVALID_SETTING_MESSAGES,
} from '#tests/config/settings/validation.ts';

test.each([...INVALID_SETTING_MESSAGES])('settings diagnostics locate $name', ({ text, message }) => {
    using sandbox = createTemporaryFolder();
    expect(() => parseSettings(text, sandbox.path)).toThrow(new GspotError('settings', message));
});

test('an import rule may import the rules above it, and a rule below is refused', () => {
    using sandbox = createTemporaryFolder();
    const settings = parseSettings(ORDERED_IMPORT_RULES, sandbox.path);
    expect(settings.import_rule).toStrictEqual([
        { name: 'storage', paths: ['storage/**'] },
        { name: 'app', paths: ['app/**'] },
        { name: 'entry', paths: ['entry/**'] },
    ]);
    expect(listAllowedRules(settings.import_rule, 1)).toStrictEqual(['app', 'storage']);
    expect(settings.written).not.toHaveProperty('import_rule.1.can_import');
    expect(() =>
        parseSettings(ORDERED_IMPORT_RULES.replace('paths = ["app/**"]', 'paths = [3]'), sandbox.path),
    ).toThrow('import_rule.1.paths.0');
});

test('can_import lists exact rules and names only declared rules', () => {
    using sandbox = createTemporaryFolder();
    const settings = parseSettings(BOUNDARY_IMPORT_RULES, sandbox.path);
    expect(settings.import_rule[1]).toStrictEqual({
        name: 'app',
        paths: ['app/**'],
        can_import: ['storage'],
    });
    expect(() =>
        parseSettings(
            BOUNDARY_IMPORT_RULES.replace('can_import = ["storage"]', 'can_import = ["missing"]'),
            sandbox.path,
        ),
    ).toThrow('import_rule.1.can_import.0: There is no import rule named missing.');
});
test('an ignore without check needs paths and takes no rule', () => {
    using sandbox = createTemporaryFolder();
    const reason = 'Product photos and facts are data, not code.';
    const settings = parseSettings(`[[ignore]]\npaths = ["assets/products/**"]\nreason = "${reason}"\n`, sandbox.path);
    expect(settings.ignore).toStrictEqual([{ paths: ['assets/products/**'], reason }]);
    expect(() => parseSettings(`[[ignore]]\nreason = "${reason}"\n`, sandbox.path)).toThrow(
        'An ignore without check needs paths.',
    );
    expect(() =>
        parseSettings(`[[ignore]]\nrule = "no-console"\npaths = ["a/**"]\nreason = "${reason}"\n`, sandbox.path),
    ).toThrow('An ignore without check cannot name a rule.');
});
test.each([...UNTIL_DATE_CASES])('$name: the until date of an ignore must be a TOML date', (row) => {
    using sandbox = createTemporaryFolder();
    const source = `configurations = ["bash"]\n[[ignore]]\ncheck="bash/shellcheck"\nreason="${REVIEWED_REASON}"\nuntil=${row.literal}\n`;
    const written = parseTomlText(source, 'dates.toml');
    expect(settingsSchema.safeParse(written).success).toBe(row.valid);
    if (!row.valid) return;
    const settings = parseSettings(source, sandbox.path);
    expect(settings.ignore[0]?.until?.toISOString()).toBe(row.date);
    const output = buildSettingsText(source, written, settingsSchema.shape.format.parse(written['format']));
    expect(output).toContain(`until = ${row.date}`);
    const parsed = buildSettingsText(
        output,
        parseTomlText(output, 'dates.toml'),
        settingsSchema.shape.format.parse(parseTomlText(output, 'dates.toml')['format']),
    );
    expect(parsed).toBe(output);
});

test.each([...UNSAFE_SCOPE_PATHS])('scope refuses the path %s', (path) => {
    using sandbox = createTemporaryFolder();
    expect(() => parseSettings(stringify({ scope: [{ path }] }), sandbox.path)).toThrow(
        'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
    );
});

test('relative folders with spaces, percent signs and Unicode are accepted', async () => {
    const path = 'apps/café 100%';
    await using sandbox = await testdir({ [`${path}/source.ts`]: 'export const count = 1;\n' });

    const settings = Object.keys(parseSettings(stringify({ scope: [{ path }] }), sandbox.path).scopes);
    expect(settings).toStrictEqual([path]);
});
test('zero and false tool options are kept as values', () => {
    using sandbox = createTemporaryFolder();
    const settings = parseSettings(
        stringify({
            configurations: ['javascript'],
            tools: { eslint: { rules: { 'id-length': [{ min: 0, properties: false }] } } },
        }),
        sandbox.path,
    );
    expect(settings.tools).toMatchObject({ eslint: { rules: { 'id-length': [{ min: 0, properties: false }] } } });
});

test.each(['ordinary', 'constructor', 'prototype', 'toString'])(
    'rule keys named like object properties are checked like any other key (%j)',
    (key) => {
        using sandbox = createTemporaryFolder();
        expect(() =>
            parseSettings(
                `configurations = ["commits"]\n[tools.commitlint.rules]\n"${key}" = ["invalid"]\n`,
                sandbox.path,
            ),
        ).toThrow(`tools.commitlint.rules.${key}: Unknown commitlint rule. Accepted rules:`);
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

test.each(['line-length', 'foo-bar'])('yamllint refuses options for an unsupported rule: %s', (rule) => {
    using sandbox = createTemporaryFolder();
    expect(() => parseSettings(`[tools.yamllint.rules]\n${rule} = { max = 100 }\n`, sandbox.path)).toThrow(
        `tools.yamllint.rules.${rule}: Unknown yamllint rule. Accepted rules:`,
    );
});

test.each([...SETTING_RULE_OPTIONS])(
    'options for $rule are refused with $setting',
    ({ tables, path, line, rule, setting }) => {
        using sandbox = createTemporaryFolder();
        expect(() => parseSettings('configurations = ["javascript", "markdown"]\n' + tables, sandbox.path)).toThrow(
            `gspot.toml:${String(line)}: ${path}: gspot writes the options of ${rule} from ${setting}. Change that setting instead: gspot set ${setting} <value>, with --reason when you raise it.`,
        );
    },
);

test('options for import boundaries direct the reader to import_rule records', () => {
    using sandbox = createTemporaryFolder();
    expect(() =>
        parseSettings(
            'configurations = ["javascript"]\n[tools.eslint.rules]\n"gspot/import-boundaries" = [{}]\n',
            sandbox.path,
        ),
    ).toThrow(
        'gspot.toml:3: tools.eslint.rules.gspot/import-boundaries: gspot writes the options of gspot/import-boundaries from the [[import_rule]] records. Change those records instead.',
    );
});

test.each(['constructor', 'toString', 'prototype'])(
    'a rule named %s is not mistaken for a setting-owned rule',
    (rule) => {
        expect(
            validateSettingsText(`configurations = ["javascript"]\n[tools.eslint.rules]\n"${rule}" = [{}]\n`),
        ).toStrictEqual([]);
    },
);

test('names in an ignore is refused for a check whose findings name no definition', () => {
    using sandbox = createTemporaryFolder();
    expect(() =>
        parseSettings(
            '[[ignore]]\ncheck = "python/ruff"\nnames = ["read"]\npaths = ["interfaces.py"]\nreason = "The framework calls these by name."\n',
            sandbox.path,
        ),
    ).toThrow(
        'names applies only to structure/trivial-functions and python/vulture, whose findings name a definition.',
    );
});

test.each(['latest', 'v20240101', 'V', '20240101__init.sql'])(
    'the freeze cutoff refuses an invalid version: %s',
    (through) => {
        using sandbox = createTemporaryFolder();
        expect(() =>
            parseSettings(`configurations = ["postgres"]\n[postgres]\nfrozen_through = "${through}"\n`, sandbox.path),
        ).toThrow(
            `gspot.toml:3: postgres.frozen_through: The value ${through} is not valid for postgres.frozen_through. Use a valid string value: The last migration version that has run everywhere (none, all, or a version); Squawk skips those migrations, and they may not change.`,
        );
    },
);

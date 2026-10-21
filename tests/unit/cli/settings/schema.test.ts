import { parse } from 'smol-toml';
import { testdir } from 'testdirs';
import { test, expect, describe } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { parseTomlText } from '#cli/settings/file.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { listAllowedRules } from '#cli/settings/import-rules.ts';
import { settingsSchema } from '#cli/schemas/settings/gspot-toml.ts';
import { publishedSettingsValidator } from '#tests/schemas/settings.ts';
import { REVIEWED_REASON, REFUSED_RULE_OPTIONS } from '#tests/data/settings/errors.ts';
import { parseSettingsText, buildSandboxSettings, validateSettingsText } from '#tests/setup/settings.ts';

import {
    UNSAFE_FOLDERS,
    UNTIL_DATE_CASES,
    REMOVED_EXTRA_TOOLS,
    SETTING_RULE_OPTIONS,
} from '#tests/data/settings/schema.ts';

describe('import rules', () => {
    test('an import rule may import the rules above it, and a rule below is refused', () => {
        const text = `[[import_rule]]
name = "storage"
paths = ["storage/**"]

[[import_rule]]
name = "app"
paths = ["app/**"]

[[import_rule]]
name = "entry"
paths = ["entry/**"]
`;
        const settings = parseSettingsText(text);
        expect(settings.import_rule).toStrictEqual([
            { name: 'storage', paths: ['storage/**'] },
            { name: 'app', paths: ['app/**'] },
            { name: 'entry', paths: ['entry/**'] },
        ]);
        expect(listAllowedRules(settings.import_rule, 1)).toStrictEqual(['app', 'storage']);
        expect(settings.written).not.toHaveProperty('import_rule.1.can_import');
        expect(() => parseSettingsText(text.replace('paths = ["app/**"]', 'paths = [3]'))).toThrow(
            'import_rule.1.paths.0',
        );
    });

    test('can_import lists exact rules and names only declared rules', () => {
        const text = `[[import_rule]]
name = "storage"
paths = ["storage/**"]

[[import_rule]]
name = "app"
paths = ["app/**"]
can_import = ["storage"]
`;
        const settings = parseSettingsText(text);
        expect(settings.import_rule[1]).toStrictEqual({
            name: 'app',
            paths: ['app/**'],
            can_import: ['storage'],
        });
        expect(() => parseSettingsText(text.replace('can_import = ["storage"]', 'can_import = ["missing"]'))).toThrow(
            'import_rule.1.can_import.0: There is no import rule named missing.',
        );
    });
});

describe('global ignores', () => {
    test('an ignore without check needs paths and takes no rule', () => {
        const reason = 'Product photos and facts are data, not code.';
        const settings = parseSettingsText(`[[ignore]]\npaths = ["assets/products/**"]\nreason = "${reason}"\n`);
        expect(settings.ignore).toStrictEqual([{ paths: ['assets/products/**'], reason }]);
        expect(() => parseSettingsText(`[[ignore]]\nreason = "${reason}"\n`)).toThrow(
            'An ignore without check needs paths.',
        );
        expect(() =>
            parseSettingsText(`[[ignore]]\nrule = "no-console"\npaths = ["a/**"]\nreason = "${reason}"\n`),
        ).toThrow('An ignore without check cannot name a rule.');
    });
});
describe('parts', () => {
    test.each([...UNTIL_DATE_CASES])('$name: the until date of an ignore must be a TOML date', (row) => {
        const source = `configurations = ["bash"]\n[[ignore]]\ncheck="bash/shellcheck"\nreason="${REVIEWED_REASON}"\nuntil=${row.literal}\n`;
        const written = parseTomlText(source, 'dates.toml');
        expect(settingsSchema.safeParse(written).success).toBe(row.valid);
        if (!row.valid) return;
        const settings = parseSettingsText(source);
        expect(settings.ignore[0]?.until?.toISOString()).toBe(row.date);
        const output = buildSettingsText(source, written);
        expect(output).toContain(`until = ${row.date}`);
        expect(buildSettingsText(output, parseTomlText(output, 'dates.toml'))).toBe(output);
    });

    test.each([...UNSAFE_FOLDERS])('scope refuses the path %s', (path) => {
        expect(() => parseSettingsText(stringify({ scope: [{ path }] }))).toThrow(
            'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
        );
    });

    test('relative folders with spaces, percent signs and Unicode are accepted', async () => {
        const path = 'apps/café 100%';
        await using sandbox = await testdir({ [`${path}/source.ts`]: 'export const count = 1;\n' });

        expect(Object.keys(parseSettingsText(stringify({ scope: [{ path }] }), sandbox.path).scopes)).toStrictEqual([
            path,
        ]);
    });
});
describe('tools', () => {
    test('zero and false tool options are kept as values', () => {
        const settings = parseSettingsText(
            stringify({
                configurations: ['javascript'],
                tools: { eslint: { rules: { 'id-length': [{ min: 0, properties: false }] } } },
            }),
        );
        expect(settings.tools).toMatchObject({ eslint: { rules: { 'id-length': [{ min: 0, properties: false }] } } });
    });

    test.each(['ordinary', 'constructor', 'prototype', 'toString'])(
        'rule keys named like object properties are checked like any other key (%j)',
        (key) => {
            expect(() =>
                parseSettingsText(`configurations = ["commits"]\n[tools.commitlint.rules]\n"${key}" = ["invalid"]\n`),
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
});

test('the published schema accepts an until date read by a TOML parser', () => {
    const text = `configurations = ["bash"]\n[[ignore]]\ncheck = "bash/shellcheck"\nreason = "${REVIEWED_REASON}"\nuntil = 2026-11-08\n`;
    const parsed: unknown = parse(text);
    expect(publishedSettingsValidator(parsed), JSON.stringify(publishedSettingsValidator.errors)).toBe(true);
    expect(publishedSettingsValidator({ ...(parsed as Record<string, unknown>), level: 'invalid' })).toBe(false);
});

test('options for a rule that a setting writes are refused with that setting: complexity, max-lines in an override, MD007', () => {
    for (const { tables, path, rule, setting } of SETTING_RULE_OPTIONS) {
        expect(() => parseSettingsText('configurations = ["javascript", "markdown"]\n' + tables)).toThrow(
            `gspot.toml: ${path}: gspot writes the options of ${rule} from ${setting}. Change that setting instead: gspot set ${setting} <value>, with --reason when you raise it.`,
        );
    }
});

test('options for import boundaries direct the reader to import_rule records', () => {
    expect(() =>
        parseSettingsText('configurations = ["javascript"]\n[tools.eslint.rules]\n"gspot/import-boundaries" = [{}]\n'),
    ).toThrow(
        'gspot.toml: tools.eslint.rules.gspot/import-boundaries: gspot writes the options of gspot/import-boundaries from the [[import_rule]] records. Change those records instead.',
    );
});

test.each(['constructor', 'toString', 'prototype'])(
    'a rule named %s is not mistaken for a setting-owned rule',
    (rule) => {
        expect(() =>
            parseSettingsText(`configurations = ["javascript"]\n[tools.eslint.rules]\n"${rule}" = [{}]\n`),
        ).not.toThrow();
    },
);

test.each([...REMOVED_EXTRA_TOOLS])('tools.%s rejects the removed raw extra table', (tool) => {
    expect(
        settingsSchema.safeParse({
            tools: {
                [tool]: { extra: { value: { enabled: true }, reason: 'The project needs this reviewed exception.' } },
            },
        }).success,
    ).toBe(false);
});

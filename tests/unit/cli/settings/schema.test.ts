import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { parseTomlText } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { REFUSED_RULE_OPTIONS } from '#tests/data/settings/errors.ts';
import { UNSAFE_FOLDERS, UNTIL_DATE_CASES } from '#tests/data/settings/schema.ts';

describe('import rules', () => {
    test('can_also_import names a declared import rule, and an absent list stays absent in the written table', () => {
        const text = `[[import_rule]]
name = "app"
paths = ["app/**"]
can_also_import = ["storage"]

[[import_rule]]
name = "storage"
paths = ["storage/**"]
`;
        const settings = parseSettings(text, undefined, createReadCache(process.cwd()));
        expect(settings.import_rule).toStrictEqual([
            { name: 'app', paths: ['app/**'], can_also_import: ['storage'] },
            { name: 'storage', paths: ['storage/**'], can_also_import: [] },
        ]);
        expect(settings.written).toMatchObject({ import_rule: [{ name: 'app' }, { name: 'storage' }] });
        expect(settings.written).not.toHaveProperty('import_rule.1.can_also_import');
        expect(() =>
            parseSettings(
                text.replace('can_also_import = ["storage"]', 'can_also_import = ["missing"]'),
                undefined,
                createReadCache(process.cwd()),
            ),
        ).toThrow('import_rule.0.can_also_import.0');
        expect(() =>
            parseSettings(text.replace('paths = ["app/**"]', 'paths = [3]'), undefined, createReadCache(process.cwd())),
        ).toThrow('import_rule.0.paths.0');
    });

    test('can_import lists exact rules, names only declared rules, and never joins can_also_import', () => {
        const text = `[[import_rule]]
name = "storage"
paths = ["storage/**"]

[[import_rule]]
name = "app"
paths = ["app/**"]
can_import = ["storage"]
`;
        const settings = parseSettings(text, undefined, createReadCache(process.cwd()));
        expect(settings.import_rule[1]).toStrictEqual({
            name: 'app',
            paths: ['app/**'],
            can_also_import: [],
            can_import: ['storage'],
        });
        expect(() =>
            parseSettings(
                text.replace('can_import = ["storage"]', 'can_import = ["missing"]'),
                undefined,
                createReadCache(process.cwd()),
            ),
        ).toThrow('import_rule.1.can_import.0: There is no import rule named missing.');
        expect(() =>
            parseSettings(
                text.replace('can_import = ["storage"]', 'can_import = ["storage"]\ncan_also_import = ["storage"]'),
                undefined,
                createReadCache(process.cwd()),
            ),
        ).toThrow('Write can_import or can_also_import, not both');
    });
});

describe('global ignores', () => {
    test('an ignore without check needs paths and takes no rule', () => {
        const reads = createReadCache(process.cwd());
        const reason = 'Product photos and facts are data, not code.';
        const settings = parseSettings(
            `[[ignore]]\npaths = ["assets/products/**"]\nreason = "${reason}"\n`,
            undefined,
            reads,
        );
        expect(settings.ignore).toStrictEqual([{ paths: ['assets/products/**'], reason }]);
        expect(() => parseSettings(`[[ignore]]\nreason = "${reason}"\n`, undefined, reads)).toThrow(
            'An ignore without check needs paths.',
        );
        expect(() =>
            parseSettings(
                `[[ignore]]\nrule = "no-console"\npaths = ["a/**"]\nreason = "${reason}"\n`,
                undefined,
                reads,
            ),
        ).toThrow('An ignore without check cannot name a rule.');
    });
});
describe('parts', () => {
    test.each([...UNTIL_DATE_CASES])('$name: the until date of an ignore must be a TOML date', (row) => {
        const source = `configurations = ["bash"]\n[[ignore]]\ncheck="bash/shellcheck"\nreason="Reviewed in tests."\nuntil=${row.literal}\n`;
        const written = parseTomlText(source, 'dates.toml', 'settings');
        expect(settingsSchema.safeParse(written).success).toBe(row.valid);
        if (!row.valid) return;
        const settings = parseSettings(source, undefined, createReadCache(process.cwd()));
        expect(settings.ignore[0]?.until?.toISOString()).toBe(row.date);
        const output = formatSettingsText(source, written);
        expect(output).toContain(`until = ${row.date}`);
        expect(formatSettingsText(output, parseTomlText(output, 'dates.toml', 'settings'))).toBe(output);
    });

    test.each([...UNSAFE_FOLDERS])('scope refuses the path %s', (path) => {
        expect(() =>
            parseSettings(stringify({ scope: [{ path }] }), undefined, createReadCache(process.cwd())),
        ).toThrow('Use a relative path with forward slashes, without parent traversal or a drive prefix.');
    });

    test('relative folders with spaces, percent signs and Unicode are accepted', async () => {
        const path = 'apps/café 100%';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [`${path}/source.ts`]: 'export const count = 1;\n' });
        expect(
            Object.keys(
                parseSettings(stringify({ scope: [{ path }] }), sandbox.path, createReadCache(process.cwd())).scopes,
            ),
        ).toStrictEqual([path]);
    });
});
describe('tools', () => {
    test('zero and false tool options are kept as values', () => {
        const settings = parseSettings(
            stringify({
                configurations: ['css', 'files'],
                tools: {
                    stylelint: { rules: { 'max-nesting-depth': 0 } },
                    taplo: { extra: { value: { reorder_keys: false }, reason: 'Reviewed in tests.' } },
                },
            }),
            undefined,
            createReadCache(process.cwd()),
        );
        expect(settings.tools).toMatchObject({
            stylelint: { rules: { 'max-nesting-depth': 0 } },
            taplo: { extra: { reorder_keys: false } },
        });
    });

    test.each(['ordinary', 'constructor', 'prototype', 'toString'])(
        'rule keys named like object properties are checked like any other key (%j)',
        (key) => {
            expect(() =>
                parseSettings(
                    `configurations = ["commits"]\n[tools.commitlint.rules]\n"${key}" = ["invalid"]\n`,
                    undefined,
                    createReadCache(process.cwd()),
                ),
            ).toThrow(`tools.commitlint.rules.${key}: Unknown commitlint rule. Accepted rules:`);
        },
    );

    test.each([...REFUSED_RULE_OPTIONS])(
        '$tool rule settings cannot turn rules on or off: $toml',
        ({ configuration, toml, message }) => {
            expect(() =>
                parseSettings(
                    buildSettingsText([configuration], { rules: true, tables: toml }),
                    undefined,
                    createReadCache(process.cwd()),
                ),
            ).toThrow(message);
        },
    );
});

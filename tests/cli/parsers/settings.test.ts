import { z } from 'zod';
import { test, expect } from 'bun:test';
import { compileSettingValue } from '#cli/policy/schema/contracts.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { settingSchemaSources } from '#cli/generation/compilation/public.ts';
import { NUMBER_SETTING_DECLARATION, RECORD_SETTING_DECLARATION } from '#tests/config/cli/parsers/settings.ts';

test('typed record items validate fields, nested paths and bounds without reader casts', () => {
    const manifest = parseConfigurationManifest('example', { tables: RECORD_SETTING_DECLARATION });
    const declaration = manifest.settings[0]!;
    const schema = compileSettingValue(declaration).schema;
    const target = { name: 'library', paths: ['src/**'], percent: 80 };
    expect(schema.parse([target])).toStrictEqual([target]);
    expect(schema.parse([{ ...target, reason: 'The native target needs this floor.' }])).toStrictEqual([
        { ...target, reason: 'The native target needs this floor.' },
    ]);
    for (const invalid of [
        [{ paths: ['src/**'], percent: 80 }],
        [{ ...target, name: 1 }],
        [{ ...target, paths: ['../sibling/**'] }],
        [{ ...target, paths: ['/outside/project'] }],
        [{ ...target, paths: [String.raw`src\file.ts`] }],
        [{ ...target, percent: 101 }],
        [{ ...target, reason: false }],
        [{ ...target, typo: true }],
    ])
        expect(schema.safeParse(invalid).success).toBe(false);
    const published = z.toJSONSchema(schema);
    expect(published).toMatchObject({
        type: 'array',
        items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'paths', 'percent'],
            properties: {
                paths: { type: 'array', items: { type: 'string' } },
                percent: { type: 'number', minimum: 0, maximum: 100 },
            },
        },
    });
});

test('scalar constraints share the compiler used for typed fields', () => {
    const manifest = parseConfigurationManifest('example', { tables: NUMBER_SETTING_DECLARATION });
    const schema = compileSettingValue(manifest.settings[0]!).schema;
    expect(schema.parse(2)).toBe(2);
    for (const invalid of [0, 5, 1.5, '2']) expect(schema.safeParse(invalid).success).toBe(false);
    expect(z.toJSONSchema(schema)).toMatchObject({ type: 'integer', minimum: 1, maximum: 4 });
});

test('declared choices retain their primitive type and numeric bounds', () => {
    const manifest = parseConfigurationManifest('example', {
        tables: NUMBER_SETTING_DECLARATION.replace('minimum = 1', 'enum = [0, 2, 4, "2"], minimum = 1'),
    });
    const schema = compileSettingValue(manifest.settings[0]!).schema;
    expect(schema.parse(2)).toBe(2);
    expect(schema.safeParse(0).success).toBe(false);
    expect(schema.safeParse('2').success).toBe(false);
});

test('item metadata refuses an undeclared field type and unknown field options', () => {
    for (const invalid of [
        RECORD_SETTING_DECLARATION.replace('name = "string"', 'name = "guess"'),
        RECORD_SETTING_DECLARATION.replace('optional = true', 'optional = true, misspelled = true'),
        RECORD_SETTING_DECLARATION.replace('items = "path"', 'items = "number"'),
    ])
        expect(() => parseConfigurationManifest('example', { tables: invalid })).toThrow('setting.0.items');
});

test('list declarations without a native item owner refuse compilation', () => {
    const manifest = parseConfigurationManifest('example', {
        tables: RECORD_SETTING_DECLARATION.slice(0, RECORD_SETTING_DECLARATION.indexOf('items = ')),
    });
    expect(() => settingSchemaSources([manifest])).toThrow();
    expect(() => compileSettingValue({ type: 'list', validation: {} })).toThrow();
});

test('declarations validate both levels of defaults with their item schema', () => {
    const declaration = RECORD_SETTING_DECLARATION.replace(
        'summary = ',
        'default = [{ name = "library", paths = ["src/**"], percent = 80 }]\ndefault_all = [{ name = "library", paths = ["src/**"], percent = 90 }]\nsummary = ',
    );
    const manifest = parseConfigurationManifest('example', { tables: declaration });
    expect(manifest.settings[0]).toMatchObject({
        default: [{ name: 'library', paths: ['src/**'], percent: 80 }],
        default_all: [{ name: 'library', paths: ['src/**'], percent: 90 }],
    });
    expect(() =>
        settingSchemaSources([
            parseConfigurationManifest('example', { tables: declaration.replace('percent = 80', 'percent = 101') }),
        ]),
    ).toThrow('example.targets.default.0.percent');
    expect(() =>
        settingSchemaSources([
            parseConfigurationManifest('example', { tables: declaration.replace('percent = 90', 'percent = "90"') }),
        ]),
    ).toThrow('example.targets.default_all.0.percent');
    expect(() =>
        settingSchemaSources([
            parseConfigurationManifest('example', {
                tables: declaration.replace(
                    'paths = ["src/**"], percent = 80',
                    'paths = ["../sibling/**"], percent = 80',
                ),
            }),
        ]),
    ).toThrow('example.targets.default.0.paths.0');
});

test('scalar declarations refuse list metadata and invalid numeric defaults', () => {
    expect(() =>
        parseConfigurationManifest('example', {
            tables: NUMBER_SETTING_DECLARATION.replace('type = "number"', 'type = "number"\nitems = "string"'),
        }),
    ).toThrow('Only a list setting declares items.');
    expect(() =>
        settingSchemaSources([
            parseConfigurationManifest('example', {
                tables: NUMBER_SETTING_DECLARATION.replace('direction = "floor"', 'direction = "floor"\ndefault = 1.5'),
            }),
        ]),
    ).toThrow('example.floor.default');
});

test('default validation uses the composed role schema including declared configuration roles', () => {
    const manifest = parseConfigurationManifest('example', {
        tables: `
[[setting]]
name = "architecture.roles"
type = "table"
direction = "neutral"
default = {scripts = ["scripts/**"]}
summary = "The authored role paths."
[[setting]]
name = "architecture.roles.scripts"
type = "list"
items = "path"
direction = "neutral"
default = []
summary = "Script paths."
`,
    });
    expect(settingSchemaSources([manifest]).size).toBe(2);
    const invalid = manifest.settings.map((declaration) =>
        declaration.name === 'architecture.roles'
            ? { ...declaration, default: { scripts: ['../outside/**'] } }
            : declaration,
    );
    expect(() => settingSchemaSources([{ ...manifest, settings: invalid }])).toThrow(
        'architecture.roles.default.scripts.0',
    );
});

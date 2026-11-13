import { stringify } from '@decimalturn/toml-patch';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { expect, test } from 'bun:test';
import type { z } from 'zod';

import { readConfigurations } from '#cli/manifests/read.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildJsonSchema, buildSettingsReference } from '#cli/settings/reference.ts';
import { PUBLISHED_SCHEMA_CASES } from '#tests/config/settings/validation.ts';
import { validateSettingsText } from '#tests/setup/cli/settings.ts';

const settings = buildSettingsReference(readConfigurations().values().toArray());

const isPublishedSettings = new Ajv2020({
    strict: true,
    strictTuples: false,
    formats: {
        uri: (value: string) => URL.canParse(value),
    },
}).compile(buildJsonSchema());

test('settings reference keeps reasoned values as leaves and names language and category inheritance', () => {
    const limits = settings.find(({ key }) => key === 'limits');
    const naming = settings.find(({ key }) => key === 'naming');
    expect(limits?.children.find(({ name }) => name === 'max_file_lines')).toMatchObject({
        kind: 'value',
        reasoned: true,
        children: [],
    });
    expect(limits?.children.find(({ name }) => name === 'javascript')?.variantOf).toBe('limits');
    const typescript = naming?.children.find(({ name }) => name === 'typescript');
    expect(typescript?.variantOf).toBe('naming');
    expect(typescript?.children.find(({ name }) => name === 'functions')?.variantOf).toBe('naming.<language>');
});

test('settings reference shows the default of a transformed setting as gspot.toml writes it', () => {
    expect(settings.find(({ key }) => key === 'removed_configurations')?.default).toEqual({});
});

test('settings reference distinguishes root-only tables and scope keys from nested required fields', () => {
    expect(settings.find(({ key }) => key === 'ci')?.rootOnly).toBe(true);
    expect(settings.find(({ key }) => key === 'level')?.rootOnly).toBe(true);
    const format = settings.find(({ key }) => key === 'format');
    expect(format?.rootOnly).toBe(false);
    expect(format?.scopeKeys).toContain('indent_width');
    const record = settings.find(({ key }) => key === 'import_rule');
    expect(record?.kind).toBe('record');
    expect(record?.children.filter(({ required }) => required).map(({ name }) => name)).toEqual(['name', 'paths']);
});

test.each([...PUBLISHED_SCHEMA_CASES])('runtime and published schemas agree on $name', ({ input, valid }) => {
    const errors = validateSettingsText(stringify(input));
    expect(errors.length === 0).toBe(valid);
    expect(isPublishedSettings(input)).toBe(valid);
});

test('the runtime schema accepts every example of the published schema', () => {
    const examples = buildJsonSchema().examples ?? [];
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) expect(settingsSchema.safeParse(example).error?.issues).toBeUndefined();
});

test('every accepted fixed property has an editor description, including nested tables', () => {
    const root = buildJsonSchema();
    function followSchemaReference(schema: z.core.JSONSchema.JSONSchema): z.core.JSONSchema.JSONSchema {
        const { $ref: reference, ...properties } = schema;
        if (reference === undefined) return schema;
        let target: unknown = root;
        for (const key of reference.split('/').slice(1)) target = (target as Record<string, unknown>)[key];
        return { ...followSchemaReference(target as z.core.JSONSchema.JSONSchema), ...properties };
    }
    function visitBranches(schema: z.core.JSONSchema.JSONSchema, path: string): void {
        const children = [...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])];
        if (schema.items !== undefined && typeof schema.items === 'object' && !Array.isArray(schema.items))
            children.push(schema.items);
        for (const child of children) visit(child, path);
    }
    function visit(schema: z.core.JSONSchema.JSONSchema, path: string): void {
        const table = followSchemaReference(schema);
        visitBranches(table, path);
        if (table.properties === undefined) return;
        const children = Object.entries(table.properties).flatMap(([key, property]) =>
            typeof property === 'boolean' ? [] : [[key, followSchemaReference(property)] as const],
        );
        for (const [key, child] of children) {
            if (child.not !== undefined) continue;
            expect(child.description?.length, path + '.' + key).toBeGreaterThan(0);
            visit(child, path + '.' + key);
        }
    }
    visit(root, 'settings');
});

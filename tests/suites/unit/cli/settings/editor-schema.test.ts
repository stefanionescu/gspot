import type { z } from 'zod';
import { test, expect } from 'bun:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { stringify } from '@decimalturn/toml-patch';
import { buildJsonSchema } from '#cli/settings/editor-schema.ts';
import { validateSettingsText } from '#tests/setup/cli/settings.ts';
import { PUBLISHED_SCHEMA_CASES } from '#tests/config/settings/validation.ts';

const isPublishedSettings = new Ajv2020({
    strict: true,
    strictTuples: false,
    formats: {
        uri: (value: string) => URL.canParse(value),
    },
}).compile(buildJsonSchema());

test.each([...PUBLISHED_SCHEMA_CASES])('runtime and published schemas agree on $name', ({ input, valid }) => {
    const errors = validateSettingsText(stringify(input));
    expect(errors.length === 0).toBe(valid);
    expect(isPublishedSettings(input)).toBe(valid);
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
        for (const [key, property] of Object.entries(table.properties)) {
            if (typeof property === 'boolean') continue;
            const child = followSchemaReference(property);
            if (child.not !== undefined) continue;
            expect(child.description, path + '.' + key).toBeString();
            expect(child.description?.length, path + '.' + key).toBeGreaterThan(0);
            visit(child, path + '.' + key);
        }
    }
    visit(root, 'settings');
});

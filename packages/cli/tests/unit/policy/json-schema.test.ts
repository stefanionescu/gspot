import { describe, expect, test } from 'bun:test';
import { policySchema } from '#cli/policy/schema.ts';
import { policyJsonSchema } from '#cli/policy/json-schema.ts';

describe('the JSON schema of gspot.toml', () => {
    test('is generated from the zod schema with the top-level tables', () => {
        const schema = policyJsonSchema();
        const properties = schema['properties'] as Record<string, unknown>;
        for (const key of [
            'version',
            'presets',
            'scope',
            'limits',
            'naming',
            'architecture',
            'structure',
            'tools',
            'ignore',
            'declare',
            'check',
            'hooks',
            'ci',
            'rules',
            'editor',
            'inspection',
            'runner',
        ])
            expect(properties).toHaveProperty(key);
        expect(schema['additionalProperties']).toBe(false);
    });

    test('the zod schema accepts the documented example shapes and rejects unknown keys', () => {
        expect(
            policySchema.safeParse({
                version: 1,
                presets: ['bash'],
                limits: { file_lines: 300, python: { file_lines: { value: 400, reason: 'why' } } },
            }).success,
        ).toBe(true);
        expect(policySchema.safeParse({ version: 1, unknown: true }).success).toBe(false);
    });
});

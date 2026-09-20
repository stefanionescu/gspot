import { describe, expect, test } from 'bun:test';
import { policySchema } from '#cli/policy/schema.ts';
import { policyJsonSchema } from '#cli/policy/json-schema.ts';

describe('the JSON schema of gspot.toml', () => {
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

test('the published schema requires ordering when a correction command is present', () => {
    expect(policyJsonSchema()).toHaveProperty('properties.check.items.dependentRequired.fix_command', ['fix_order']);
});

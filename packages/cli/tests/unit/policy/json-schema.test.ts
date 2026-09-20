import { Ajv2020 } from 'ajv/dist/2020.js';
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

test('the published schema accepts a check and requires ordering for its correction command', () => {
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    const check = { name: 'project/lint', command: ['lint'], paths: ['src/**'], stage: 'commit' };
    expect(validate({ version: 1, check: [check] })).toBe(true);
    expect(validate({ version: 1, check: [{ ...check, fix_command: ['lint', '--fix'] }] })).toBe(false);
    expect(validate({ version: 1, check: [{ ...check, fix_command: ['lint', '--fix'], fix_order: 'format' }] })).toBe(
        true,
    );
    expect(validate({ version: 1, check: [{ ...check, fix_command: ['lint', '--fix'], fix_order: 'unknown' }] })).toBe(
        false,
    );
});

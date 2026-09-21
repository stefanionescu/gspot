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

test.each([{ command: [] }, { command: [''] }, { command: ['tool'] }, { command: ['tool', ''] }])(
    'runtime and published schemas agree on the argument vector $command',
    ({ command }) => {
        const input = {
            version: 1,
            check: [{ name: 'project/arguments', command, paths: ['source.txt'], stage: 'commit' }],
        };
        const valid = command.length > 0 && command[0] !== '';
        expect(policySchema.safeParse(input).success).toBe(valid);
        const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
        expect(validate(input)).toBe(valid);
    },
);

test.each([
    { rules: { eqeqeq: ['error', 'smart'] }, valid: true },
    { rules: { eqeqeq: [1, 'always'] }, valid: true },
    { rules: { eqeqeq: 'off' }, valid: false },
    { rules: { eqeqeq: [0] }, valid: false },
    { rules: { eqeqeq: true }, valid: false },
])('runtime and published schemas validate enabled ESLint override rules: %j', ({ rules, valid }) => {
    const input = { version: 1, tools: { eslint: { overrides: [{ paths: ['src'], rules }] } } };
    expect(policySchema.safeParse(input).success).toBe(valid);
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    expect(validate(input)).toBe(valid);
});

test.each([
    { override: { paths: ['src'], indent_width: 8, quotes: 'double' }, valid: true },
    { override: { paths: ['src'] }, valid: false },
    { override: { paths: [''], quotes: 'single' }, valid: false },
    { override: { paths: ['src'], indent_width: 0 }, valid: false },
    { override: { paths: ['src'], quotes: 'backtick' }, valid: false },
    { override: { paths: ['src'], overrides: [] }, valid: false },
])('runtime and public schemas agree on formatter override %j', ({ override, valid }) => {
    const input = { version: 1, format: { overrides: [override] } };
    expect(policySchema.safeParse(input).success).toBe(valid);
    expect(new Ajv2020({ strict: false }).compile(policyJsonSchema())(input)).toBe(valid);
});

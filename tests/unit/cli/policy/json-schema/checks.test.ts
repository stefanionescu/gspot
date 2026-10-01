import { Ajv2020 } from 'ajv/dist/2020.js';
import { test, expect, describe } from 'bun:test';
import { policySchema } from '#cli/policy/schema.ts';
import { policyJsonSchema } from '#cli/policy/json-schema.ts';

describe('the JSON schema of gspot.toml', () => {
    test('the zod schema accepts the documented example shapes and rejects unknown keys', () => {
        expect(
            policySchema.safeParse({
                version: 1,
                kits: ['bash'],
                limits: { file_lines: 300, python: { file_lines: { value: 400, reason: 'why' } } },
            }).success,
        ).toBe(true);
        expect(policySchema.safeParse({ version: 1, unknown: true }).success).toBe(false);
    });
});

test.each([
    { codes: [2], valid: true },
    { codes: [0], valid: false },
    { codes: [256], valid: false },
    { codes: ['2'], valid: false },
])('finding codes $codes require valid process codes', ({ codes, valid }) => {
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    const input = {
        version: 1,
        check: [
            {
                name: 'project/lint',
                command: ['checker'],
                paths: ['src/**'],
                stage: 'commit',
                findings_exit_codes: codes,
            },
        ],
    };
    expect(policySchema.safeParse(input).success).toBe(valid);
    expect(validate(input)).toBe(valid);
});

test('the published schema accepts a check with and without its correction command', () => {
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    const check = { name: 'project/lint', command: ['lint'], paths: ['src/**'], stage: 'commit' };
    expect(validate({ version: 1, check: [check] })).toBe(true);
    expect(validate({ version: 1, check: [{ ...check, fix_command: ['lint', '--fix'] }] })).toBe(true);
    expect(validate({ version: 1, check: [{ ...check, fix_order: 'format' }] })).toBe(false);
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
    { codes: [1], valid: true },
    { codes: [2], valid: true },
    { codes: [], valid: true },
    { codes: [0], valid: false },
    { codes: [256], valid: false },
    { codes: ['1'], valid: false },
])('finding exit declarations preserve runtime and editor validation for $codes', ({ codes, valid }) => {
    const input = {
        version: 1,
        check: [
            {
                name: 'project/check',
                command: ['checker'],
                paths: ['src/**'],
                stage: 'commit',
                findings_exit_codes: codes,
            },
        ],
    };
    expect(policySchema.safeParse(input).success).toBe(valid);
    expect(new Ajv2020({ strict: false }).compile(policyJsonSchema())(input)).toBe(valid);
});

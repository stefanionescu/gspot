import { policyJsonSchema } from '#cli/policy/json-schema.ts';
import { policySchema } from '#cli/policy/schema.ts';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, test } from 'bun:test';

describe('the JSON schema of gspot.toml', () => {
    test('the zod schema accepts the documented example shapes and rejects unknown keys', () => {
        expect(
            policySchema.safeParse({
                version: 1,
                configurations: ['bash'],
                limits: { file_lines: 300, python: { file_lines: { value: 400, reason: 'why' } } },
            }).success,
        ).toBe(true);
        expect(policySchema.safeParse({ version: 1, unknown: true }).success).toBe(false);
    });
});

test.each([
    { codes: [2], command: true, valid: true },
    { codes: [0], command: true, valid: false },
    { codes: [256], command: true, valid: false },
    { codes: ['2'], command: true, valid: false },
    { codes: [2], command: false, valid: false },
])(
    'correction finding codes $codes require valid process codes and a correction command',
    ({ codes, command, valid }) => {
        const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
        const input = {
            version: 1,
            check: [
                {
                    name: 'project/lint',
                    command: ['checker'],
                    paths: ['src/**'],
                    stage: 'commit',
                    fix_order: 'codemod',
                    fix_findings_exit_codes: codes,
                    ...(command ? { fix_command: ['checker', '--fix'] } : {}),
                },
            ],
        };
        expect(policySchema.safeParse(input).success).toBe(valid);
        expect(validate(input)).toBe(valid);
    },
);

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

import { stringify } from 'smol-toml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { test, expect, describe } from 'bun:test';
import { policySchema } from '#cli/policy/schema.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { failure } from '#tests/harness/expectations.ts';
import { policyJsonSchema } from '#cli/policy/json-schema.ts';
import { parsePolicyText, assertPolicyComplete } from '#cli/policy/read.ts';

const check = { name: 'project/lint', command: ['lint'], paths: ['src/**'], stage: 'commit' };

describe('the JSON schema of gspot.toml', () => {
    test('the zod schema accepts the documented example shapes and rejects unknown keys', () => {
        expect(
            policySchema.safeParse({
                kits: ['bash'],
                limits: { file_lines: 300, python: { file_lines: { value: 400, reason: 'why' } } },
            }).success,
        ).toBe(true);
        expect(policySchema.safeParse({ unknown: true }).success).toBe(false);
    });

    test('the published schema accepts a check with and without its correction command', () => {
        const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
        expect(validate({ check: [check] })).toBe(true);
        expect(validate({ check: [{ ...check, fix: ['lint', '--fix'] }] })).toBe(true);
    });
});

test.each([
    { name: 'finding code 2', input: { check: [{ ...check, exit_codes: [2] }] }, valid: true },
    { name: 'finding code 0', input: { check: [{ ...check, exit_codes: [0] }] }, valid: false },
    { name: 'finding code 256', input: { check: [{ ...check, exit_codes: [256] }] }, valid: false },
    { name: 'a text finding code', input: { check: [{ ...check, exit_codes: ['2'] }] }, valid: false },
    { name: 'an empty command', input: { check: [{ ...check, command: [] }] }, valid: false },
    { name: 'an empty program', input: { check: [{ ...check, command: [''] }] }, valid: false },
    { name: 'an empty argument', input: { check: [{ ...check, command: ['tool', ''] }] }, valid: true },
    {
        name: 'a formatter override',
        input: { format: { overrides: [{ paths: ['src'], indent_width: 8, quotes: 'double' }] } },
        valid: true,
    },
    {
        name: 'a formatter override without a setting',
        input: { format: { overrides: [{ paths: ['src'] }] } },
        valid: false,
    },
    {
        name: 'a pinned license exception',
        input: {
            tools: {
                licenses: {
                    packages_allowed: [
                        { package: '@example/scoped@1.2.3-beta.1', license: 'MIT', reason: 'Verified.' },
                    ],
                },
            },
        },
        valid: true,
    },
    {
        name: 'a license exception with a version range',
        input: {
            tools: {
                licenses: {
                    packages_allowed: [{ package: 'example@^1.2.3', license: 'MIT', reason: 'Version range' }],
                },
            },
        },
        valid: false,
    },
    {
        name: 'a reasoned Squawk transaction value',
        input: { tools: { squawk: { assume_in_transaction: { value: false, reason: 'Runs outside transactions.' } } } },
        valid: true,
    },
    {
        name: 'a SQLFluff dialect that injects a directive',
        input: { tools: { sqlfluff: { dialect: 'sqlite\nexclude_rules = ALL' } } },
        valid: false,
    },
    {
        name: 'a snapshot layout',
        input: { tools: { xctest: { reference_layout: '__Snapshots__/{file}/{test}.*' } } },
        valid: true,
    },
    {
        name: 'a snapshot layout outside the scope',
        input: { tools: { xctest: { reference_layout: '../{file}/{test}.*' } } },
        valid: false,
    },
])('runtime and published schemas agree on $name', ({ input, valid }) => {
    const document = { ...input };
    expect(policySchema.safeParse(document).success).toBe(valid);
    expect(new Ajv2020({ strict: false }).compile(policyJsonSchema())(document)).toBe(valid);
});

test('manifest settings validate their kind in root and scope tables', () => {
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    for (const [scoped, translations, valid] of [
        [false, [], false],
        [true, [], false],
        [false, { directory: 'messages', base: 'en' }, true],
        [true, { directory: 'messages', base: 'en' }, true],
    ] as const) {
        const tools = { i18n: { translations } };
        const document = { kits: ['i18n'], ...(scoped ? { scope: [{ path: 'app', tools }] } : { tools }) };
        const text = stringify(document);
        const policy = parsePolicyText(text, 'gspot.toml');
        const refusal = failure(() => {
            assertPolicyComplete({ text, path: 'gspot.toml', policy });
        });
        expect(refusal?.message.slice(0, 12)).toBe(valid ? undefined : 'gspot.toml: ');
        expect(validate(document)).toBe(valid);
    }
});

test('nested manifest settings preserve typed leaf values and reject unknown siblings', () => {
    const source = policyOf(['bash'], '[tools.bash.safety]\nowners = ["scripts/cleanup.sh"]\n');
    const path = 'gspot.toml';
    const policy = parsePolicyText(source, path);
    expect(() => {
        assertPolicyComplete({ text: source, path, policy });
    }).not.toThrow();
    const invalid = source + 'unknown = true\n';
    const invalidPolicy = parsePolicyText(invalid, path);
    expect(() => {
        assertPolicyComplete({ text: invalid, path, policy: invalidPolicy });
    }).toThrow('gspot.toml: tools.bash.safety.unknown:');
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    expect(validate({ kits: ['bash'], tools: { bash: { safety: { owners: ['scripts/cleanup.sh'] } } } })).toBe(true);
    expect(validate({ kits: ['bash'], tools: { bash: { safety: { unknown: true } } } })).toBe(false);
});

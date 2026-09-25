import { policyJsonSchema } from '#cli/policy/json-schema.ts';
import { policySchema } from '#cli/policy/schema.ts';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { expect, test } from 'bun:test';

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

test.each([
    { package: 'example@1.2.3', license: 'MIT', reason: 'Verified dependency license.', valid: true },
    { package: '@example/scoped@1.2.3-beta.1', license: 'MIT', reason: 'Verified dependency license.', valid: true },
    { package: 'python-package@1.2rc1', license: 'BSD', reason: 'Verified dependency metadata.', valid: true },
    { package: 'example@^1.2.3', license: 'MIT', reason: 'Version range', valid: false },
    { package: 'example@latest', license: 'MIT', reason: 'Unpinned version', valid: false },
    { package: 'example@1.2.3', license: '', reason: 'Missing license', valid: false },
    { package: 'example@1.2.3', license: 'MIT', reason: '', valid: false },
])('license exception $package requires a version, reported license, and reason', ({ valid, ...exception }) => {
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    const tools = { licenses: { licenses_allowed: ['MIT'], packages_allowed: [exception] } };
    for (const input of [
        { version: 1, configurations: ['xcode', 'docs'], tools },
        { version: 1, configurations: ['xcode', 'docs'], scope: [{ path: 'app', tools }] },
    ]) {
        expect(policySchema.safeParse(input).success).toBe(valid);
        expect(validate(input)).toBe(valid);
    }
});

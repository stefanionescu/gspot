import { expect, test } from 'bun:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { policySchema } from '#cli/policy/schema.ts';
import { policyJsonSchema } from '#cli/policy/json-schema.ts';

test.each([
    { value: false, valid: true },
    { value: true, valid: true },
    { value: { value: false, reason: 'The deployment runs statements outside transactions.' }, valid: true },
    { value: 'false', valid: false },
    { value: 0, valid: false },
])('runtime and published schemas agree on Squawk transaction value $value', ({ value, valid }) => {
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    for (const input of [
        { version: 1, tools: { squawk: { assume_in_transaction: value } } },
        { version: 1, scope: [{ path: 'db', tools: { squawk: { assume_in_transaction: value } } }] },
    ]) {
        expect(policySchema.safeParse(input).success).toBe(valid);
        expect(validate(input)).toBe(valid);
    }
});

test.each([
    { locale: 'en', valid: true },
    { locale: 'en-us', valid: true },
    { locale: 'en-gb', valid: true },
    { locale: 'en-ca', valid: true },
    { locale: { value: 'en-au', reason: 'Published for an Australian audience.' }, valid: true },
    { locale: 'en_US', valid: false },
    { locale: 'unknown', valid: false },
    { locale: '', valid: false },
])('runtime and published schemas agree on typos locale $locale', ({ locale, valid }) => {
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    for (const input of [
        { version: 1, tools: { typos: { locale } } },
        { version: 1, scope: [{ path: 'docs', tools: { typos: { locale } } }] },
    ]) {
        expect(policySchema.safeParse(input).success).toBe(valid);
        expect(validate(input)).toBe(valid);
    }
});

test.each([
    { dialect: 'postgres', valid: true },
    { dialect: 'sqlite', valid: true },
    { dialect: { value: 'duckdb', reason: 'Analytics uses the DuckDB engine.' }, valid: true },
    { dialect: 'sqlite\n', valid: false },
    { dialect: 'sqlite\nexclude_rules = ALL', valid: false },
    { dialect: '[sqlfluff]', valid: false },
    { dialect: '', valid: false },
])('runtime and published schemas agree on SQLFluff dialect $dialect', ({ dialect, valid }) => {
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    for (const input of [
        { version: 1, tools: { sqlfluff: { dialect } } },
        { version: 1, scope: [{ path: 'db', tools: { sqlfluff: { dialect } } }] },
    ]) {
        expect(policySchema.safeParse(input).success).toBe(valid);
        expect(validate(input)).toBe(valid);
    }
});

test.each([
    { layout: '__Snapshots__/{file}/{test}.*', valid: true },
    { layout: 'References/{file}-{test}.png', valid: true },
    { layout: '../{file}/{test}.*', valid: false },
    { layout: '/{file}/{test}.*', valid: false },
    { layout: '{file}/{test}/{file}', valid: false },
    { layout: '{file}/{test}/{test}', valid: false },
    { layout: '{file}/{unknown}', valid: false },
    { layout: '{file}/{test}\n', valid: false },
])('runtime and published schemas agree on snapshot layout $layout', ({ layout, valid }) => {
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    const input = { version: 1, tools: { xctest: { reference_layout: layout } } };
    expect(policySchema.safeParse(input).success).toBe(valid);
    expect(validate(input)).toBe(valid);
});

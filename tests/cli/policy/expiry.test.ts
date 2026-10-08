import { test, expect } from 'bun:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { localDateSchema } from '#cli/policy/schema/fields.ts';
import { buildJsonSchema } from '#docs/src/content/reference/schema.ts';
import { emitPolicy, parseTomlText, parseExpiryDate } from '#cli/policy/file.ts';
import { POLICY_EXPIRY_CASES, UNREPRESENTABLE_POLICY_COMMENT } from '#tests/config/cli/policy/expiry.ts';

for (const { name, literal, valid, date, syntaxError } of POLICY_EXPIRY_CASES)
    test(`${name} retains strict native expiry validation and source locations`, () => {
        const source = `[[ignore]]\ncheck="gspot/policy"\nreason="The fixture tests expiry dates."\nuntil=${literal}\n`;
        if (syntaxError !== undefined) {
            expect(() => parseTomlText(source, 'dates.toml', 'policy')).toThrow(
                `dates.toml:4:7 is not valid TOML: ${syntaxError}`,
            );
            return;
        }
        const raw = parseTomlText(source, 'dates.toml', 'policy');
        expect(policySchema.safeParse(raw).success).toBe(valid);
        if (!valid) return;
        const policy = parseStrictPolicy(source);
        expect(policy.ignore[0]?.until?.toISOString()).toBe(date);
        const output = emitPolicy(source, raw);
        expect(output).toContain(`until = ${date}`);
        expect(emitPolicy(output, parseTomlText(output, 'dates.toml', 'policy'))).toBe(output);
    });

test('the published expiry representation agrees with the documented native calendar values', () => {
    const validate = new Ajv2020({ strict: false, formats: { date: true } }).compile(buildJsonSchema());
    for (const { valid, date } of POLICY_EXPIRY_CASES) {
        if (!valid) continue;
        expect(
            validate({ ignore: [{ check: 'gspot/policy', reason: 'The fixture tests expiry dates.', until: date }] }),
        ).toBe(true);
    }
    expect(
        validate({
            ignore: [{ check: 'gspot/policy', reason: 'The fixture tests expiry dates.', until: '2026-02-29' }],
        }),
    ).toBe(false);
    // JSON represents dates as strings; the runtime parser proves the TOML token kind.
    expect(localDateSchema.safeParse('2026-12-31').success).toBe(false);
    expect(localDateSchema.safeParse(new Date('2026-12-31')).success).toBe(false);
});

test('invalid CLI expiry arguments refuse calendar rollover and time components', () => {
    expect(parseExpiryDate('2024-02-29').toISOString()).toBe('2024-02-29');
    for (const text of ['2026-02-29', '1900-02-29', '2026-12-31T00:00:00Z', 'later'])
        expect(() => parseExpiryDate(text)).toThrow('until must be a valid calendar date in YYYY-MM-DD form.');
});

test('a surviving inline field comment refuses an unrepresentable write with its exact field path', () => {
    const raw = parseTomlText(UNREPRESENTABLE_POLICY_COMMENT, 'gspot.toml', 'policy');
    expect(() => emitPolicy(UNREPRESENTABLE_POLICY_COMMENT, raw)).toThrow(
        'The comment for tools.eslint.verbatim.mixed.0.enabled cannot be represented in TOML 1.0.',
    );
});

test('native parser failures retain the supplied template location and Unicode column', () => {
    expect(() => parseTomlText('"🚦前言"=2026-04-31\n', 'https://example.com/team.toml', 'template')).toThrow(
        'https://example.com/team.toml:1:8 is not valid TOML: "2026-04-31": day 31 invalid for 2026-04',
    );
    expect(() => parseTomlText('level="all"\nlevel="all"\n', 'gspot.toml', 'policy')).toThrow(
        'gspot.toml:2:1 is not valid TOML: Value already defined for level',
    );
});

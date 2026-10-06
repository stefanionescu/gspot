import { stringify } from 'smol-toml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { test, expect, describe } from 'bun:test';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { NAMING_SCHEMA_CASES } from '#tests/config/cli/docs/naming.ts';
import { buildPolicy, policyProblems } from '#tests/harness/policy.ts';
import { buildJsonSchema } from '#docs/src/content/reference/schema.ts';
import { UNSAFE_DIRECTORIES } from '#tests/config/cli/policy/boundaries.ts';
import { EXCEPTION_SCHEMA_CASES } from '#tests/config/cli/docs/exceptions.ts';
import { SCHEMA_CHECK, LOCALE_SCHEMA_CASES, RUNTIME_SCHEMA_CASES } from '#tests/config/cli/docs/schema.ts';

const validate = new Ajv2020({ strict: false }).compile(buildJsonSchema());

describe('the JSON schema of gspot.toml', () => {
    test('the zod schema accepts the documented example shapes and rejects unknown keys', () => {
        expect(
            policySchema.safeParse({
                configurations: ['bash'],
                limits: { file_lines: 300, python: { file_lines: { value: 400, reason: 'why' } } },
            }).success,
        ).toBe(true);
        expect(policySchema.safeParse({ unknown: true }).success).toBe(false);
    });

    test('the published schema accepts a check with and without its correction command', () => {
        expect(validate({ check: [SCHEMA_CHECK] })).toBe(true);
        expect(validate({ check: [{ ...SCHEMA_CHECK, fix: ['lint', '--fix'] }] })).toBe(true);
    });
});

test.each([...RUNTIME_SCHEMA_CASES, ...NAMING_SCHEMA_CASES, ...EXCEPTION_SCHEMA_CASES])(
    'runtime and published schemas agree on $name',
    ({ input, valid, diagnostic }) => {
        const document = { ...input };
        const text = stringify(document);
        const problems = policyProblems(text);
        if (valid) expect(problems).toStrictEqual([]);
        else expect(problems).toContainEqual(textContaining(diagnostic));
        expect(validate(document)).toBe(valid);
    },
);

test.each(LOCALE_SCHEMA_CASES)('manifest settings validate $name', ({ scoped: nested, locales, valid }) => {
    const settings = { i18n: { locales } };
    const document = {
        configurations: ['i18n'],
        ...(nested ? { scope: [{ path: 'app', ...settings }] } : settings),
    };
    const text = stringify(document);
    const key = nested ? 'scope.0.i18n.locales' : 'i18n.locales';
    if (valid) expect(() => parseStrictPolicy(text)).not.toThrow();
    else expect(() => parseStrictPolicy(text)).toThrow(key);
    expect(validate(document)).toBe(valid);
});

test('manifest settings preserve typed values and reject unknown siblings', () => {
    const source = buildPolicy(['bash'], { tables: '[bash]\nsafety_owners = ["scripts/cleanup.sh"]\n' });
    expect(parseStrictPolicy(source).configurationSettings?.['bash']).toMatchObject({
        safety_owners: ['scripts/cleanup.sh'],
    });
    const invalid = source + 'unknown = true\n';
    expect(() => {
        parseStrictPolicy(invalid);
    }).toThrow('gspot.toml: bash.unknown:');
    expect(validate({ configurations: ['bash'], bash: { safety_owners: ['scripts/cleanup.sh'] } })).toBe(true);
    expect(validate({ configurations: ['bash'], bash: { unknown: true } })).toBe(false);
});

test.each(UNSAFE_DIRECTORIES)(
    'published and runtime schemas reject an escaping agent-rule project folder %j',
    (path) => {
        const input = { agent_rules: { project_folder: path } };
        expect(policySchema.safeParse(input).success).toBe(false);
        expect(validate(input)).toBe(false);
    },
);

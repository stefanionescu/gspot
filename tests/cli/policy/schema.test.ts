import { z } from 'zod';
import { stringify } from 'smol-toml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { test, expect, describe } from 'bun:test';
import { isRecord } from '#cli/platform/contracts.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { policySchema } from '#cli/policy/schema/public.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { buildPolicy, policyFindings } from '#tests/harness/policy.ts';
import { policyReference } from '#docs/src/content/reference/policy.ts';
import { buildJsonSchema } from '#docs/src/content/reference/schema.ts';
import { emitPolicy, parseTomlText } from '#cli/policy/document/public.ts';
import { UNSAFE_DIRECTORIES } from '#tests/config/cli/policy/boundaries.ts';
import { NAMING_SCHEMA_CASES } from '#tests/config/cli/policy/schema/naming.ts';
import { POLICY_FIELD_SCHEMA_CASES } from '#tests/config/cli/policy/schema/fields.ts';
import { EXCEPTION_SCHEMA_CASES } from '#tests/config/cli/policy/schema/exceptions.ts';

import {
    SCHEMA_CHECK,
    OWN_RECORD_KEYS,
    LOCALE_SCHEMA_CASES,
    RUNTIME_SCHEMA_CASES,
} from '#tests/config/cli/policy/schema/cases.ts';
import {
    TOOL_SCHEMA_CASES,
    TOOL_SCHEMA_SCOPES,
    VERBATIM_TOOL_NAMES,
    NO_VERBATIM_TOOL_NAMES,
} from '#tests/config/cli/policy/schema/tools.ts';

const examples = z.array(z.unknown()).parse(policySchema.meta()?.['examples']);

const validate = new Ajv2020({ strict: false }).compile(buildJsonSchema());

describe('the JSON schema of gspot.toml', () => {
    test('the zod schema accepts the documented example shapes and rejects unknown keys', () => {
        expect(
            policySchema.safeParse({
                configurations: ['bash'],
                limits: { file_lines: 300, python: { file_lines: 400 } },
                reasons: {
                    'limits.file_lines': 'The source has long declarative tables.',
                    'limits.python.file_lines': 'The source has long declarative tables.',
                },
            }).success,
        ).toBe(true);
        expect(policySchema.safeParse({ unknown: true }).success).toBe(false);
    });

    test('the published schema accepts a check with and without its correction command', () => {
        expect(validate({ check: { 'project/lint': SCHEMA_CHECK } })).toBe(true);
        expect(validate({ check: { 'project/lint': { ...SCHEMA_CHECK, fix: ['lint', '--fix'] } } })).toBe(true);
        for (const key of OWN_RECORD_KEYS) {
            for (const [table, value] of [
                ['check', SCHEMA_CHECK],
                ['scope', {}],
                ['words', 'A project term.'],
            ] as const) {
                const document = { [table]: Object.fromEntries([[key, value]]) };
                const result = policySchema.parse(document);
                expect(Object.keys({ ...result[table] })).toStrictEqual([key]);
                expect(validate(document)).toBe(true);
                const invalid = { [table]: Object.fromEntries([[key, 5]]) };
                const rejected = policySchema.safeParse(invalid);
                expect(rejected.success).toBe(false);
                if (!rejected.success) expect(rejected.error.issues[0]?.path).toStrictEqual([table, key]);
                expect(validate(invalid)).toBe(false);
            }
        }
        expect(Object.hasOwn(Object.prototype, 'command')).toBe(false);
    });
});

test.each(OWN_RECORD_KEYS.flatMap((key) => ['', 'app'].map((scope) => ({ key, scope }))))(
    'numeric limit $key retains its authored key with scope=$scope',
    ({ key, scope }) => {
        const fields = {
            limits: Object.fromEntries([[key, 1]]),
            reasons: { [`limits.${key}`]: 'The project has a reviewed numeric limit.' },
        };
        const input = scope === '' ? fields : { scope: { app: fields } };
        const output = policySchema.parse(input);
        const values = scope === '' ? output.limits : output.scope?.['app']?.limits;
        expect(Object.keys(values!)).toStrictEqual([key]);
        expect(validate(input)).toBe(true);
        const invalid = { ...fields, limits: Object.fromEntries([[key, 'invalid']]) };
        const rejected = scope === '' ? invalid : { scope: { app: invalid } };
        expect(policySchema.safeParse(rejected).success).toBe(false);
        expect(validate(rejected)).toBe(false);
    },
);

test.each([
    ...RUNTIME_SCHEMA_CASES,
    ...POLICY_FIELD_SCHEMA_CASES,
    ...NAMING_SCHEMA_CASES,
    ...EXCEPTION_SCHEMA_CASES.flatMap((entry) =>
        Object.hasOwn(entry.input, 'words')
            ? [entry]
            : [
                  entry,
                  {
                      ...entry,
                      name: 'scope.app.' + entry.name,
                      input: { scope: { app: entry.input } },
                      ...(entry.valid
                          ? {}
                          : {
                                diagnostic: entry.diagnostic
                                    .replace('gspot.toml: ', 'gspot.toml: scope.app.')
                                    .replace('under [', 'under [scope.app.'),
                            }),
                  },
              ],
    ),
])('runtime and published schemas agree on $name', ({ input, valid, diagnostic }) => {
    const document = { ...input };
    const text = stringify(document);
    const errors = policyFindings(text);
    if (valid) expect(errors).toStrictEqual([]);
    else expect(errors).toContainEqual(textContaining(diagnostic));
    expect(validate(document)).toBe(valid);
});

test.each(LOCALE_SCHEMA_CASES)(
    'manifest settings validate $name',
    ({ scoped: nested, settings: translationSettings, key: setting, valid }) => {
        const settings = { translations: translationSettings };
        const document = {
            configurations: ['translations'],
            ...(nested ? { scope: { app: settings } } : settings),
        };
        const text = stringify(document);
        const table = `${nested ? 'scope.app.' : ''}translations`;
        const key =
            setting === 'locales' ? `\`locales\` is not a setting gspot knows under [${table}]` : `${table}.${setting}`;
        if (valid) expect(() => parseStrictPolicy(text)).not.toThrow();
        else expect(() => parseStrictPolicy(text)).toThrow(key);
        expect(validate(document)).toBe(valid);
    },
);

test('manifest settings preserve typed values and reject unknown siblings', () => {
    const source = buildPolicy(['translations'], {
        agentRules: true,
        tables: '[translations]\nmessages_folder = "messages"\nbase_locale = "fr"\n',
    });
    expect(parseStrictPolicy(source).configurationSettings?.['translations']).toMatchObject({
        messages_folder: 'messages',
        base_locale: 'fr',
    });
    const invalid = source + 'unknown = true\n';
    expect(() => {
        parseStrictPolicy(invalid);
    }).toThrow('`unknown` is not a setting gspot knows under [translations]');
    expect(
        validate({
            configurations: ['translations'],
            translations: { messages_folder: 'messages', base_locale: 'fr' },
        }),
    ).toBe(true);
    expect(validate({ configurations: ['translations'], translations: { unknown: true } })).toBe(false);
});

test.each(UNSAFE_DIRECTORIES)(
    'published and runtime schemas reject an escaping agent-rule project folder %j',
    (path) => {
        const input = { agent_rules: { own_rules_folder: path } };
        expect(policySchema.safeParse(input).success).toBe(false);
        expect(validate(input)).toBe(false);
    },
);

for (const scope of TOOL_SCHEMA_SCOPES)
    test.each(TOOL_SCHEMA_CASES)(
        `runtime and published tool schemas agree in ${scope || 'root'} on $name`,
        ({ input, valid, diagnostic }) => {
            const { configurations, ...table } = input;
            const document = { configurations, ...(scope === '' ? table : { scope: { [scope]: table } }) };
            const errors = policyFindings(stringify(document));
            if (valid) expect(errors).toStrictEqual([]);
            else {
                const owner = scope === '' ? '' : `scope.${scope}.`;
                expect(errors).toContainEqual(
                    textContaining(diagnostic.replace('under [tools', `under [${owner}tools`)),
                );
            }
            expect(validate(document)).toBe(valid);
        },
    );

for (const scope of TOOL_SCHEMA_SCOPES)
    test.each([...VERBATIM_TOOL_NAMES, ...NO_VERBATIM_TOOL_NAMES])(
        `native verbatim applicability agrees in ${scope || 'root'} for %s`,
        (tool) => {
            const key = `tools.${tool}.verbatim`;
            const table = {
                tools: {
                    [tool]: {
                        verbatim: { native_option: { value: false, reason: 'The native option keeps its own key.' } },
                    },
                },
                reasons: { [key]: 'The native writer owns these project options.' },
            };
            const document = scope === '' ? table : { scope: { [scope]: table } };
            const accepted = VERBATIM_TOOL_NAMES.includes(tool);
            expect(policySchema.safeParse(document).success).toBe(accepted);
            expect(validate(document)).toBe(accepted);
            expect(policyFindings(stringify(document)).length === 0).toBe(accepted);
        },
    );

test.each(examples)('native policy metadata example %j parses in every published surface', (example) => {
    const document = policySchema.parse(example);
    expect(() => parseStrictPolicy(stringify(document))).not.toThrow();
    expect(validate(example)).toBe(true);
});

test('the policy reference emits canonical examples and retains native editor metadata', () => {
    expect(buildJsonSchema()['examples']).toEqual(examples);
    const reference = policyReference();
    for (const example of examples.filter(isRecord)) {
        const text = emitPolicy('', example);
        if (text.trim() !== '') expect(reference).toContain(text);
    }
    expect(reference).toContain('[hooks]\nenabled = true\npush_files = "all"\n');
    for (const match of reference.matchAll(/```toml\n([\s\S]*?)```/gu)) {
        const text = match[1]!;
        expect(text).toBeDefined();
        expect(text.trim()).not.toBe('');
        const document = parseTomlText(text, 'gspot.toml', 'policy');
        expect(policySchema.safeParse(document).success).toBe(true);
        expect(emitPolicy(text, document)).toBe(text);
    }
});

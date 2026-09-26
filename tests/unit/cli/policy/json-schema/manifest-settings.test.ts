import { policyJsonSchema } from '#cli/policy/json-schema.ts';
import { parsePolicyText } from '#cli/policy/read.ts';
import { assertPolicyComplete } from '#cli/policy/read.ts';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { expect, test } from 'bun:test';
import { stringify } from 'smol-toml';

test.each([
    { configuration: 'docs', tool: 'docs', key: 'contents_threshold', bad: 'many', good: 6 },
    { configuration: 'docs', tool: 'docs', key: 'require_license', bad: 'false', good: true },
    { configuration: 'xcode', tool: 'xcode', key: 'project', bad: 42, good: 'App.xcodeproj' },
    { configuration: 'xcode', tool: 'xcode', key: 'entitlements_allowed', bad: 'one', good: [] },
    { configuration: 'i18n', tool: 'i18n', key: 'translations', bad: [], good: { directory: 'messages', base: 'en' } },
])(
    'manifest settings validate $tool.$key kinds in root and scope tables',
    ({ configuration, tool, key, bad, good }) => {
        const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
        for (const scoped of [false, true]) {
            const tools = { [tool]: { [key]: bad } };
            const input = {
                version: 1,
                configurations: [configuration],
                ...(scoped ? { scope: [{ path: 'app', tools }] } : { tools }),
            };
            const text = stringify(input);
            const path = 'gspot.toml';
            const policy = parsePolicyText(text, path);
            expect(() => assertPolicyComplete({ text, path, policy })).toThrow(/gspot.toml:\d+:/);
            expect(validate(input)).toBe(false);
            const correctedTools = { [tool]: { [key]: good } };
            const corrected = {
                version: 1,
                configurations: [configuration],
                ...(scoped ? { scope: [{ path: 'app', tools: correctedTools }] } : { tools: correctedTools }),
            };
            const correctedText = stringify(corrected);
            const correctedPolicy = parsePolicyText(correctedText, path);
            expect(() => assertPolicyComplete({ text: correctedText, path, policy: correctedPolicy })).not.toThrow();
            expect(validate(corrected)).toBe(true);
        }
    },
);

test('nested manifest settings preserve typed leaf values and reject unknown siblings', () => {
    const source = 'version = 1\nconfigurations = ["bash"]\n[tools.bash.safety]\nowners = ["scripts/cleanup.sh"]\n';
    const path = 'gspot.toml';
    const policy = parsePolicyText(source, path);
    expect(() => assertPolicyComplete({ text: source, path, policy })).not.toThrow();
    const invalid = source + 'unknown = true\n';
    const invalidPolicy = parsePolicyText(invalid, path);
    expect(() => assertPolicyComplete({ text: invalid, path, policy: invalidPolicy })).toThrow('gspot.toml:5:');
    const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
    expect(
        validate({
            version: 1,
            configurations: ['bash'],
            tools: { bash: { safety: { owners: ['scripts/cleanup.sh'] } } },
        }),
    ).toBe(true);
    expect(validate({ version: 1, configurations: ['bash'], tools: { bash: { safety: { unknown: true } } } })).toBe(
        false,
    );
});

test.each([{ safety: [] }, { safety: 'owners' }, { safety: 1 }, { safety: { owners: false } }])(
    'nested setting containers reject %j without changing their declared leaf shape',
    ({ safety }) => {
        const input = { version: 1, configurations: ['bash'], tools: { bash: { safety } } };
        const text = stringify(input);
        const path = 'gspot.toml';
        const policy = parsePolicyText(text, path);
        expect(() => assertPolicyComplete({ text, path, policy })).toThrow(/gspot.toml:\d+:/);
        expect(new Ajv2020({ strict: false }).compile(policyJsonSchema())(input)).toBe(false);
    },
);

import { stringify } from 'smol-toml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, test } from 'bun:test';
import { policySchema } from '#cli/policy/schema.ts';
import { parsePolicyText } from '#cli/policy/read-policy.ts';
import { policyJsonSchema } from '#cli/policy/json-schema.ts';
import { assertPolicyComplete } from '#cli/policy/validate-policy.ts';

test.each([
    {
        configuration: 'static-site',
        tool: 'site',
        previous: 'sitemap_excluded',
        current: 'sitemap_allowed',
        value: ['404.html'],
    },
    {
        configuration: 'express',
        tool: 'express',
        previous: 'route_glob',
        current: 'route_files',
        value: ['routes/*.ts'],
    },
    { configuration: 'express', tool: 'express', previous: 'test_glob', current: 'test_files', value: ['tests/*.ts'] },
    { configuration: 'trpc', tool: 'trpc', previous: 'server_paths', current: 'server_files', value: ['server/**'] },
    {
        configuration: 'supabase',
        tool: 'supabase',
        previous: 'functions_dir',
        current: 'functions_directory',
        value: 'edge',
    },
    {
        configuration: 'postgres',
        tool: 'postgres',
        previous: 'migrations_dir',
        current: 'migrations_directory',
        value: 'schema',
    },
    {
        configuration: 'supabase',
        tool: 'supabase',
        previous: 'admin_key_paths',
        current: 'admin_key_files',
        value: ['server/**'],
    },
    {
        configuration: 'xcode',
        tool: 'xcode',
        previous: 'allowed_entitlements',
        current: 'entitlements_allowed',
        value: ['aps-environment'],
    },
    {
        configuration: 'html',
        tool: 'html',
        previous: 'copy_excluded',
        current: 'copy_allowed',
        value: [{ paths: ['fixtures/**'], reason: 'Localization is verified by the fixture producer.' }],
    },
])(
    '$tool.$current follows the public vocabulary without retaining $previous as an alias',
    ({ configuration, tool, previous, current, value }) => {
        const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
        for (const scoped of [false, true]) {
            for (const key of [previous, current]) {
                const tools = { [tool]: { [key]: value } };
                const input = {
                    version: 1,
                    configurations: [configuration],
                    ...(scoped ? { scope: [{ path: 'app', tools }] } : { tools }),
                };
                const text = stringify(input);
                const path = 'gspot.toml';
                const policy = parsePolicyText(text, path);
                if (key === previous) expect(() => assertPolicyComplete({ text, path, policy })).toThrow(previous);
                else expect(() => assertPolicyComplete({ text, path, policy })).not.toThrow();
                expect(validate(input)).toBe(key === current);
            }
        }
    },
);

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

test.each([
    { version: 1, presets: ['typescript'] },
    { version: 1, scope: [{ path: 'app', presets: ['react'] }] },
])('legacy selection fields are rejected by runtime and published schemas: %j', (input) => {
    expect(policySchema.safeParse(input).success).toBe(false);
    expect(new Ajv2020({ strict: false }).compile(policyJsonSchema())(input)).toBe(false);
});

test.each([{ xcode: { orphan_assets: false } }, { docs: { readme_shape: false } }])(
    'runtime and editor schemas require tracked rule exceptions instead of obsolete switches: %j',
    (tools) => {
        const validate = new Ajv2020({ strict: false }).compile(policyJsonSchema());
        for (const input of [
            { version: 1, configurations: ['xcode', 'docs'], tools },
            { version: 1, configurations: ['xcode', 'docs'], scope: [{ path: 'app', tools }] },
        ]) {
            const text = stringify(input);
            const path = 'gspot.toml';
            const policy = parsePolicyText(text, path);
            expect(() => assertPolicyComplete({ text, path, policy })).toThrow(/gspot.toml:\d+:/);
            expect(validate(input)).toBe(false);
        }
        const corrected = {
            version: 1,
            ignore: [
                {
                    check: 'xcode/asset-catalogs',
                    rule: 'orphan-asset',
                    reason: 'Assets are selected by a runtime catalog.',
                },
            ],
        };
        const text = stringify(corrected);
        const path = 'gspot.toml';
        const policy = parsePolicyText(text, path);
        expect(() => assertPolicyComplete({ text, path, policy })).not.toThrow();
        expect(validate(corrected)).toBe(true);
    },
);

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

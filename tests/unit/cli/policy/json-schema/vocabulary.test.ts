import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { policyJsonSchema } from '#cli/policy/json-schema.ts';
import { failure, textContaining } from '#tests/support/expectations.ts';
import { parsePolicyText, assertPolicyComplete } from '#cli/policy/read.ts';

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
                // The retired key is refused by name; the current key is accepted.
                const refused = failure(() => {
                    assertPolicyComplete({ text, path, policy });
                });
                const namesPrevious = textContaining(previous);
                expect(refused?.message).toStrictEqual(key === previous ? namesPrevious : undefined);
                expect(validate(input)).toBe(key === current);
            }
        }
    },
);

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
            expect(() => {
                assertPolicyComplete({ text, path, policy });
            }).toThrow(/gspot.toml:\d+:/);
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
        expect(() => {
            assertPolicyComplete({ text, path, policy });
        }).not.toThrow();
        expect(validate(corrected)).toBe(true);
    },
);

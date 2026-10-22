import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { stringify } from '@decimalturn/toml-patch';
import { matchItems } from '#tests/setup/matchers.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { MAPPED_SCHEMAS, MAPPED_SCHEMA_ENTRIES } from '#tests/data/generation/config-files/builders/v8r.ts';

test.each([true, false])(
    'the v8r catalog lists the shipped schemas and your custom schemas ($name)',
    async (hasSchemas) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['data-files'], {
                level: 'all',
                rules: true,
                tables: stringify({
                    tools: {
                        v8r: {
                            schema: hasSchemas ? [...MAPPED_SCHEMAS] : [],
                        },
                    },
                }),
            }),
            'custom.json': '{}\n',
        });

        const output = generate(await openSession(sandbox.path));
        const text = output.files.find(
            (file) => file.path === '.gspot/configurations/general/data-files/v8r.yml',
        )!.content;
        const parsed: unknown = parse(text);
        if (hasSchemas)
            expect(parsed).toMatchObject({
                customCatalog: {
                    schemas: matchItems([...MAPPED_SCHEMA_ENTRIES]),
                },
            });
        expect(text).toContain('name: mise');
        expect(text).not.toContain('name: gspot');
        expect(output.files.some((file) => file.path.endsWith('/gspot-toml.schema.json'))).toBe(false);
    },
);

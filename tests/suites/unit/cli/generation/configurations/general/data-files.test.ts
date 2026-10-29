import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { openSession } from '#cli/planning/session.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { MAPPED_SCHEMAS, MAPPED_SCHEMA_RECORDS } from '#tests/config/generation/configurations/general/data-files.ts';

test.each([true, false])(
    'the v8r catalog maps mise, gspot.toml, and the custom schemas (custom schemas: %p)',
    async (hasSchemas) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['data-files'], {
                level: 'all',
                tables: stringify({ tools: { v8r: { schema: hasSchemas ? [...MAPPED_SCHEMAS] : [] } } }),
            }),
            'custom.json': '{}\n',
        });

        const session = await openSession(sandbox.path);
        const v8rFile = generateFiles(session).files.find((file) => file.path === getConfigFilePath(session, 'v8r'))!;
        expect(parse(v8rFile.content)).toStrictEqual({
            ignoreErrors: true,
            customCatalog: {
                schemas: [
                    {
                        name: 'mise',
                        description: 'The mise settings file',
                        fileMatch: [
                            'mise.toml',
                            '.mise.toml',
                            '.mise/conf.d/*.toml',
                            '.config/mise/config.toml',
                            '.config/mise/conf.d/*.toml',
                            '.gspot/mise.toml',
                        ],
                        location: 'https://mise.jdx.dev/schema/mise.json',
                    },
                    {
                        name: 'gspot',
                        description: 'The gspot settings file',
                        fileMatch: ['gspot.toml'],
                        location: '.gspot/gspot.schema.json',
                    },
                    ...(hasSchemas ? MAPPED_SCHEMA_RECORDS : []),
                ],
            },
        });
    },
);

import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { openSession } from '#cli/planning/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { MAPPED_SCHEMAS, MAPPED_SCHEMA_RECORDS } from '#tests/config/generation/configurations/general.ts';

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
        const v8rFile = buildGeneratedFiles(session).files.find(
            (file) => file.path === getConfigFilePath(session, 'v8r'),
        )!;
        expect(parse(v8rFile.content)).toStrictEqual({
            ignoreErrors: true,
            customCatalog: {
                schemas: [
                    expect.objectContaining({
                        name: 'mise',
                        fileMatch: expect.arrayContaining(['mise.toml', '.gspot/mise.toml']) as string[],
                    }) as object,
                    ...(hasSchemas ? MAPPED_SCHEMA_RECORDS : []),
                ],
            },
        });
    },
);

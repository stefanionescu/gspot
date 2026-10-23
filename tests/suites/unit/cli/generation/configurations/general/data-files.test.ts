import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { stringify } from '@decimalturn/toml-patch';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findConfigFilePath } from '#tests/setup/cli/config-files.ts';
import { MISE_SCHEMA, SETTINGS_SCHEMA } from '#cli/config/generation/configurations/general/data-files/v8r.ts';
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
        const v8rFile = generate(session).files.find((file) => file.path === findConfigFilePath(session, 'v8r'))!;
        // v8r checks gspot.toml against the schema of the gspot version that wrote it, never the newest one.
        expect(parse(v8rFile.content)).toStrictEqual({
            ignoreErrors: true,
            customCatalog: { schemas: [MISE_SCHEMA, SETTINGS_SCHEMA, ...(hasSchemas ? MAPPED_SCHEMA_RECORDS : [])] },
        });
    },
);

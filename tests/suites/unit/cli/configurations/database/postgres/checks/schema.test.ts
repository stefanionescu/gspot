import { expect, test } from 'bun:test';

import { buildDatabaseSchema } from '#cli/configurations/database/postgres/checks/schema/build.ts';
import { parseSqlFile } from '#cli/parsers/code/sql.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { DATABASE_SCHEMA_CASES } from '#tests/config/configurations/database.ts';

test.each([...DATABASE_SCHEMA_CASES])('$name', async ({ migrations, schema: expected }) => {
    const cache = createRunCache(process.cwd());
    const schema = buildDatabaseSchema(
        await Promise.all(
            migrations.map(async (text, index) => {
                const { statements } = await parseSqlFile(text, cache);
                const version = String(index + 1);
                return {
                    path: `migrations/${version}_change.sql`,
                    name: `${version}_change.sql`,
                    version,
                    text,
                    statements,
                };
            }),
        ),
    );
    expect<object>({
        tables: schema.tables.keys().toArray(),
        secured: [...schema.secured],
        foreignKeys: schema.foreignKeys.map(({ table, columns }) => `${table} (${columns.join(', ')})`),
        indexed: [...schema.indexed],
    }).toStrictEqual(expected);
});

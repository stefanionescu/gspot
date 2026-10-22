import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import { extractSqlIdentifiers } from '#cli/checks/general/naming/languages/sql.ts';

import {
    SQL_DECLARATIONS,
    SQL_DECLARED_NAMES,
    QUALIFIED_SQL_NAMES,
    QUALIFIED_FUNCTION_DECLARATION,
} from '#tests/config/checks/general/naming/languages.ts';

test('every SQL name comes with its category and line', async () => {
    const { identifiers: found } = await extractSqlIdentifiers(
        'schema.sql',
        SQL_DECLARATIONS,
        createReadCache(process.cwd()),
    );
    expect(found.map((entry) => [entry.category, entry.name, entry.line])).toStrictEqual([...SQL_DECLARED_NAMES]);
    expect(found[1]?.label).toBe('sql table');
});
test('psql variables are not names, and quoted names keep their positions', async () => {
    const source = '\\set table accounts\nCREATE TABLE :table ("createdAt" int);\nCREATE TABLE :"id" (id int);';
    const { identifiers } = await extractSqlIdentifiers('schema.sql', source, createReadCache(process.cwd()));
    expect(identifiers.map(({ name, line, column }) => ({ name, line, column }))).toStrictEqual([
        { name: 'createdAt', line: 2, column: 23 },
        { name: 'id', line: 3, column: 21 },
    ]);
});
test('qualified SQL function and parameter names use their own declaration positions', async () => {
    const { identifiers: found } = await extractSqlIdentifiers(
        'schema.sql',
        QUALIFIED_FUNCTION_DECLARATION,
        createReadCache(process.cwd()),
    );
    expect(found.map(({ category, name, line, column }) => ({ category, name, line, column }))).toStrictEqual([
        ...QUALIFIED_SQL_NAMES,
    ]);
});

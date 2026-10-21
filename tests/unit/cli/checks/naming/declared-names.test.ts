import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type Identifier } from '#cli/types/checks/naming.ts';
import { readNamingDefaults } from '#cli/configurations/naming.ts';
import { parseIdentifiers } from '#cli/checks/naming/declared-names.ts';
import { extractSqlIdentifiers } from '#cli/checks/naming/languages/sql.ts';
import { buildFileIdentifier, buildFolderIdentifiers } from '#cli/checks/naming/paths.ts';
import { SQL_DECLARATIONS, QUALIFIED_FUNCTION_DECLARATION } from '#tests/data/checks/sql.ts';

import {
    NAME_POSITION_CASES,
    DECLARATION_SAMPLES,
    DECLARATION_ORDER_CASES,
} from '#tests/data/checks/naming/sources.ts';

/** Parse one source and dispose its parser resources. */
async function listIdentifiers(file: string, source: string, language: string): Promise<Identifier[]> {
    using resources = new DisposableStack();
    const { identifiers } = await parseIdentifiers(file, source, language, {
        reads: createReadCache(process.cwd()),
        resources,
    });
    return identifiers;
}

test.each([...DECLARATION_SAMPLES])(
    'identifiers: $language declarations are collected by category',
    async ({ language, path, source, expected, absent }) => {
        const found = await listIdentifiers(path, source, language);
        const byCategory: Readonly<Record<string, readonly string[]>> = expected;
        expect(
            Object.fromEntries(
                Object.keys(byCategory).map((category) => [
                    category,
                    found.filter((entry) => entry.category === category).map((entry) => entry.name),
                ]),
            ),
        ).toStrictEqual(
            Object.fromEntries(Object.entries(byCategory).map(([category, names]) => [category, [...names]])),
        );
        for (const name of absent) expect(found.map((entry) => entry.name)).not.toContain(name);
    },
);

test('identifiers: a name bound from another module through require or await import is skipped, and nothing else', async () => {
    const source = [
        "const { existsSync } = require('node:fs');",
        "const { default: lazyWidget } = await import('./widget.js');",
        'const loadedRecord = await loadRecord();',
        'const eagerTotal = computeTotal();',
    ].join('\n');
    const found = await listIdentifiers('src/bind.ts', source, 'typescript');
    expect(found.map((entry) => entry.name)).toStrictEqual(['loadedRecord', 'eagerTotal']);
});

test('identifiers: Bash functions and variables are collected', async () => {
    const found = await listIdentifiers(
        'scripts/run.sh',
        'readonly ROOT=1\nlocal count\nbuild_all() {\n  TARGET=x\n}\n',
        'bash',
    );
    expect(found.map((entry) => `${entry.category}:${entry.name}`)).toStrictEqual([
        'variables:ROOT',
        'variables:count',
        'functions:build_all',
        'variables:TARGET',
    ]);
});

test.each([...DECLARATION_ORDER_CASES])(
    'identifiers: $language declarations arrive in document order, including names on the same line',
    async ({ file, source, language, expected }) => {
        const found = await listIdentifiers(file, source, language);
        expect(found.map(({ name }) => name)).toStrictEqual([...expected]);
        expect(found.every((identifier) => identifier.file === file && identifier.language === language)).toBe(true);
    },
);

test('identifiers: JavaScript destructured and arrow parameters are declarations; object keys are not', async () => {
    const found = await listIdentifiers(
        'source.js',
        'function loadValue({ account: localAccount }, [firstValue], ...remainingValues) {}\nconst readValue = inputValue => inputValue;\n',
        'javascript',
    );
    expect(found.map(({ name, category }) => ({ name, category }))).toStrictEqual([
        { name: 'loadValue', category: 'functions' },
        { name: 'localAccount', category: 'parameters' },
        { name: 'firstValue', category: 'parameters' },
        { name: 'remainingValues', category: 'parameters' },
        { name: 'readValue', category: 'variables' },
        { name: 'inputValue', category: 'parameters' },
    ]);
});

test.each([...NAME_POSITION_CASES])(
    'identifiers: $language names keep their line and column; discarded names such as _ are left out',
    async ({ file, language, source, expected }) => {
        const found = await listIdentifiers(file, source, language);
        expect(found.map(({ name, category, line, column }) => ({ name, category, line, column }))).toStrictEqual([
            ...expected,
        ]);
    },
);

test('identifiers: shared route containers retain punctuation without changing plain paths', () => {
    const containers = readNamingDefaults().path_containers;
    expect(buildFileIdentifier('app/[...slug].ts', 'typescript', containers)).toMatchObject({
        name: 'slug',
        category: 'path_parameters',
    });
    for (const name of ['(group)', '@slot', '_private'])
        expect(buildFileIdentifier(`app/${name}.ts`, 'typescript', containers)).toMatchObject({
            name,
            category: 'files',
        });
    expect(buildFileIdentifier('app/[slug].ts', 'typescript', [])).toMatchObject({
        name: '[slug]',
        category: 'files',
    });
    expect(
        buildFolderIdentifiers('app/(group)/@slot/_private/[id]/page.ts', 'typescript', []).map(({ name }) => name),
    ).toStrictEqual(['app', '(group)', '@slot', '_private', '[id]']);
});

test('identifiers: the stem drops one extension, or the whole declaration suffix', () => {
    expect(buildFileIdentifier('src/a-b.test.ts', 'typescript', []).name).toBe('a-b.test');
    expect(buildFileIdentifier('types/modules.d.ts', 'typescript', []).name).toBe('modules');
    expect(buildFileIdentifier('db/20240101010101_add_users.sql', 'sql', []).name).toBe('20240101010101_add_users.sql');
});

test('identifiers: Next.js segments are unwrapped and dot folders skipped', () => {
    const containers = readNamingDefaults().path_containers;
    const names = buildFolderIdentifiers(
        'app/(marketing)/[slug]/@modal/_lib/.hidden/page.tsx',
        'typescript',
        containers,
    );
    expect(names.map((entry) => `${entry.category}:${entry.name}`)).toStrictEqual([
        'folders:app',
        'folders:marketing',
        'path_parameters:slug',
        'folders:modal',
        'folders:lib',
    ]);
    expect(names[2]?.folder).toBe('app/(marketing)/[slug]');
    expect(buildFileIdentifier('app/[...rest]/page.tsx', 'typescript', containers)).toMatchObject({
        name: 'page',
        category: 'files',
    });
});
test('sql: every SQL name comes with its category and line', async () => {
    const { identifiers: found } = await extractSqlIdentifiers(
        'schema.sql',
        SQL_DECLARATIONS,
        createReadCache(process.cwd()),
    );
    expect(found.map((entry) => [entry.category, entry.name, entry.line])).toStrictEqual([
        ['schemas', 'app', 2],
        ['tables', 'user_accounts', 4],
        ['columns', 'id', 5],
        ['columns', 'displayName', 6],
        ['columns', 'created_at', 9],
        ['indexes', 'user_accounts_created_idx', 10],
        ['functions', 'touch_account', 11],
        ['parameters', 'account_id', 11],
        ['policies', 'owner_reads', 12],
        ['triggers', 'touch_on_write', 13],
        ['tables', 'active_accounts', 14],
    ]);
    expect(found[1]?.label).toBe('sql table');
});

test('sql: psql variables are not names, and quoted names keep their positions', async () => {
    const source = '\\set table accounts\nCREATE TABLE :table ("createdAt" int);\nCREATE TABLE :"id" (id int);';
    const { identifiers } = await extractSqlIdentifiers('schema.sql', source, createReadCache(process.cwd()));
    expect(identifiers.map(({ name, line, column }) => ({ name, line, column }))).toStrictEqual([
        { name: 'createdAt', line: 2, column: 23 },
        { name: 'id', line: 3, column: 21 },
    ]);
});

test('sql: qualified SQL function and parameter names use their own declaration positions', async () => {
    const { identifiers: found } = await extractSqlIdentifiers(
        'schema.sql',
        QUALIFIED_FUNCTION_DECLARATION,
        createReadCache(process.cwd()),
    );
    expect(found.map(({ category, name, line, column }) => ({ category, name, line, column }))).toStrictEqual([
        { category: 'functions', name: 'same', line: 1, column: 22 },
        { category: 'parameters', name: 'same', line: 1, column: 39 },
        { category: 'parameters', name: 'out', line: 1, column: 77 },
        { category: 'parameters', name: 'variadic', line: 1, column: 101 },
        { category: 'functions', name: 'named', line: 3, column: 23 },
        { category: 'parameters', name: 'named', line: 4, column: 5 },
        { category: 'parameters', name: 'out', line: 5, column: 6 },
    ]);
});

test.each([
    ['pyproject.toml', 'python', '[tool.comfy]\nDisplayName = "Live Shopping"\nPublisherId = "acme"\n'],
    ['setup.cfg', 'python', '[metadata]\nLongName = value\n'],
    ['package.json', 'javascript', '{"name": "app", "MainEntry": "index.js"}\n'],
])(
    'identifiers: the settings file %s of the %s configuration holds no code identifiers',
    async (path, language, source) => {
        const identifiers = await listIdentifiers(path, source, language);
        expect(identifiers).toStrictEqual([]);
    },
);

import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createRunCache } from '#cli/system/cache.ts';
import { parseSqlFile } from '#cli/parsers/code/sql.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildDatabaseSchema } from '#cli/checks/database/postgres/schema.ts';

import {
    RENAMED_TABLE_SQL,
    RECREATED_TABLE_SQL,
    EQUIVALENT_INDEXES_SQL,
    DROPPED_CONSTRAINTS_SQL,
} from '#tests/config/checks/database/postgres/postgres.ts';

test('table and column renames retain their foreign keys, indexes, and row security', async () => {
    const renamedTable = await parseSqlFile(RENAMED_TABLE_SQL, createRunCache(process.cwd()));
    const schema = buildDatabaseSchema([
        {
            path: 'migrations/1_rename.sql',
            name: '1_rename.sql',
            version: '1',
            text: RENAMED_TABLE_SQL,
            statements: renamedTable.statements,
        },
    ]);
    expect(schema.tables.keys().toArray()).toStrictEqual(['public.groups']);
    expect([...schema.secured]).toStrictEqual(['public.groups']);
    expect(schema.foreignKeys).toStrictEqual([
        {
            path: 'migrations/1_rename.sql',
            offset: 0,
            text: RENAMED_TABLE_SQL,
            table: 'public.groups',
            columns: ['organization_id', 'user_id'],
        },
    ]);
    expect([...schema.indexed]).toStrictEqual([['public.groups', [['organization_id', 'user_id']]]]);
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], {
            level: 'all',
            tables: '[postgres]\nclient_schemas = ["public"]\n',
        }),
        'migrations/1_rename.sql': RENAMED_TABLE_SQL,
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/row-level-security')).toStrictEqual([]);
    expect(await runSandboxCheck(sandbox.path, 'postgres/foreign-key-indexes')).toStrictEqual([]);
});

test('keys count as indexes, a table constraint names its columns, and a dropped table leaves', async () => {
    const createdTables = await parseSqlFile(
        'CREATE TABLE posts (id UUID PRIMARY KEY, author_id UUID REFERENCES users (id), team_id UUID, CONSTRAINT team_fk FOREIGN KEY (team_id) REFERENCES teams (id));\nCREATE TABLE drafts (id UUID PRIMARY KEY, post_id UUID REFERENCES posts (id));',
        createRunCache(process.cwd()),
    );
    const addedIndex = await parseSqlFile(
        'CREATE INDEX posts_author_idx ON posts (author_id, id);\nDROP TABLE drafts;',
        createRunCache(process.cwd()),
    );
    const fields = buildDatabaseSchema([
        {
            path: 'migrations/1_create.sql',
            name: '1_create.sql',
            version: '1',
            text: 'CREATE TABLE posts (id UUID PRIMARY KEY, author_id UUID REFERENCES users (id), team_id UUID, CONSTRAINT team_fk FOREIGN KEY (team_id) REFERENCES teams (id));\nCREATE TABLE drafts (id UUID PRIMARY KEY, post_id UUID REFERENCES posts (id));',
            statements: createdTables.statements,
        },
        {
            path: 'migrations/2_index.sql',
            name: '2_index.sql',
            version: '2',
            text: 'CREATE INDEX posts_author_idx ON posts (author_id, id);\nDROP TABLE drafts;',
            statements: addedIndex.statements,
        },
    ]);
    expect(fields.tables.keys().toArray()).toStrictEqual(['public.posts']);
    expect(fields.foreignKeys.map((key) => `${key.table}.${key.columns.join(',')}`)).toStrictEqual([
        'public.posts.author_id',
        'public.posts.team_id',
    ]);
    expect(fields.indexed.get('public.posts')).toStrictEqual([['id'], ['author_id', 'id']]);
});

test('table recreation discards security, keys, and indexes from the old table', async () => {
    const recreatedTable = await parseSqlFile(RECREATED_TABLE_SQL, createRunCache(process.cwd()));
    const fields = buildDatabaseSchema([
        {
            path: 'migrations/1_reset.sql',
            name: '1_reset.sql',
            version: '1',
            text: RECREATED_TABLE_SQL,
            statements: recreatedTable.statements,
        },
    ]);
    expect(fields.tables.keys().toArray()).toStrictEqual(['public.posts']);
    expect([...fields.secured]).toStrictEqual([]);
    expect([...fields.indexed]).toStrictEqual([]);
    expect(fields.foreignKeys.map((key) => key.columns)).toStrictEqual([['author_id']]);
});

test('removing one equivalent index preserves the other until it is removed, and disabling row security removes it', async () => {
    const equivalentIndexes = await parseSqlFile(EQUIVALENT_INDEXES_SQL, createRunCache(process.cwd()));
    const initial = {
        path: 'migrations/1_create.sql',
        name: '1_create.sql',
        version: '1',
        text: EQUIVALENT_INDEXES_SQL,
        statements: equivalentIndexes.statements,
    };
    const kept = buildDatabaseSchema([initial]);
    expect(kept.indexed.get('public.posts')).toStrictEqual([['author_id']]);
    const removedIndex = await parseSqlFile(
        'DROP INDEX second;\nALTER TABLE posts DISABLE ROW LEVEL SECURITY;\n',
        createRunCache(process.cwd()),
    );
    const removed = buildDatabaseSchema([
        initial,
        {
            path: 'migrations/2_drop.sql',
            name: '2_drop.sql',
            version: '2',
            text: 'DROP INDEX second;\nALTER TABLE posts DISABLE ROW LEVEL SECURITY;\n',
            statements: removedIndex.statements,
        },
    ]);
    expect([...removed.secured]).toStrictEqual([]);
    expect([...removed.indexed]).toStrictEqual([]);
});

test('dropped foreign and unique constraints remove only the fields they own', async () => {
    const droppedConstraints = await parseSqlFile(DROPPED_CONSTRAINTS_SQL, createRunCache(process.cwd()));
    const initial = {
        path: 'migrations/1_keys.sql',
        name: '1_keys.sql',
        version: '1',
        text: DROPPED_CONSTRAINTS_SQL,
        statements: droppedConstraints.statements,
    };
    const kept = buildDatabaseSchema([initial]);
    expect(kept.foreignKeys.map((key) => key.columns)).toStrictEqual([['team_id']]);
    expect(kept.indexed.get('public.posts')).toStrictEqual([['author_id']]);
    const removedIndex = await parseSqlFile('DROP INDEX author_index;', createRunCache(process.cwd()));
    const removed = buildDatabaseSchema([
        initial,
        {
            path: 'migrations/2_drop.sql',
            name: '2_drop.sql',
            version: '2',
            text: 'DROP INDEX author_index;',
            statements: removedIndex.statements,
        },
    ]);
    expect([...removed.indexed]).toStrictEqual([]);
});

test('an unnamed foreign key gets the PostgreSQL default name and does not count as an index', async () => {
    const unnamedKeys = await parseSqlFile(
        'CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id), title text UNIQUE, CHECK (id > 0));',
        createRunCache(process.cwd()),
    );
    const initial = {
        path: 'migrations/1_keys.sql',
        name: '1_keys.sql',
        version: '1',
        text: 'CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id), title text UNIQUE, CHECK (id > 0));',
        statements: unnamedKeys.statements,
    };
    const fields = buildDatabaseSchema([initial]);
    expect(fields.foreignKeys.map(({ columns }) => columns)).toStrictEqual([['author_id']]);
    expect(fields.indexed.get('public.posts')).toStrictEqual([['id'], ['title']]);
    const droppedForeignKey = await parseSqlFile(
        'ALTER TABLE posts DROP CONSTRAINT posts_author_id_fkey;',
        createRunCache(process.cwd()),
    );
    const removed = buildDatabaseSchema([
        initial,
        {
            path: 'migrations/2_drop.sql',
            name: '2_drop.sql',
            version: '2',
            text: 'ALTER TABLE posts DROP CONSTRAINT posts_author_id_fkey;',
            statements: droppedForeignKey.statements,
        },
    ]);
    expect(removed.foreignKeys).toStrictEqual([]);
    expect(removed.indexed.get('public.posts')).toStrictEqual([['id'], ['title']]);
});

test('column additions and removals update foreign keys and indexes', async () => {
    const addedColumn = await parseSqlFile(
        'CREATE TABLE posts (id int); ALTER TABLE posts ADD COLUMN user_id int REFERENCES users(id); CREATE INDEX post_users ON posts(user_id);',
        createRunCache(process.cwd()),
    );
    const initial = {
        path: 'migrations/1_create.sql',
        name: '1_create.sql',
        version: '1',
        text: 'CREATE TABLE posts (id int); ALTER TABLE posts ADD COLUMN user_id int REFERENCES users(id); CREATE INDEX post_users ON posts(user_id);',
        statements: addedColumn.statements,
    };
    const added = buildDatabaseSchema([initial]);
    expect(added.foreignKeys.map(({ columns }) => columns)).toStrictEqual([['user_id']]);
    const droppedColumn = await parseSqlFile('ALTER TABLE posts DROP COLUMN user_id;', createRunCache(process.cwd()));
    const removed = buildDatabaseSchema([
        initial,
        {
            path: 'migrations/2_drop.sql',
            name: '2_drop.sql',
            version: '2',
            text: 'ALTER TABLE posts DROP COLUMN user_id;',
            statements: droppedColumn.statements,
        },
    ]);
    expect(removed.foreignKeys).toStrictEqual([]);
    expect([...removed.indexed]).toStrictEqual([]);
});

test('renamed constraints and indexes can be dropped by their new names', async () => {
    const renamedConstraints = await parseSqlFile(
        'CREATE TABLE posts (id int, user_id int, CONSTRAINT user_fk FOREIGN KEY(user_id) REFERENCES users(id)); CREATE INDEX user_idx ON posts(user_id); ALTER TABLE posts RENAME CONSTRAINT user_fk TO renamed_fk; ALTER INDEX user_idx RENAME TO renamed_idx; ALTER TABLE posts DROP CONSTRAINT renamed_fk; DROP INDEX renamed_idx;',
        createRunCache(process.cwd()),
    );
    const migration = {
        path: 'migrations/1_rename.sql',
        name: '1_rename.sql',
        version: '1',
        text: 'CREATE TABLE posts (id int, user_id int, CONSTRAINT user_fk FOREIGN KEY(user_id) REFERENCES users(id)); CREATE INDEX user_idx ON posts(user_id); ALTER TABLE posts RENAME CONSTRAINT user_fk TO renamed_fk; ALTER INDEX user_idx RENAME TO renamed_idx; ALTER TABLE posts DROP CONSTRAINT renamed_fk; DROP INDEX renamed_idx;',
        statements: renamedConstraints.statements,
    };
    const schema = buildDatabaseSchema([migration]);
    expect(schema.foreignKeys).toStrictEqual([]);
    expect([...schema.indexed]).toStrictEqual([]);
});

test('partial indexes do not cover foreign keys and schema changes retain security and index ownership', async () => {
    const movedSchema = await parseSqlFile(
        'CREATE TABLE posts (id int, user_id int REFERENCES users(id)); CREATE INDEX partial_users ON posts(user_id) WHERE user_id > 0; ALTER TABLE posts ENABLE ROW LEVEL SECURITY; ALTER TABLE posts SET SCHEMA client;',
        createRunCache(process.cwd()),
    );
    const migration = {
        path: 'migrations/1_move.sql',
        name: '1_move.sql',
        version: '1',
        text: 'CREATE TABLE posts (id int, user_id int REFERENCES users(id)); CREATE INDEX partial_users ON posts(user_id) WHERE user_id > 0; ALTER TABLE posts ENABLE ROW LEVEL SECURITY; ALTER TABLE posts SET SCHEMA client;',
        statements: movedSchema.statements,
    };
    const schema = buildDatabaseSchema([migration]);
    expect([...schema.tables.keys()]).toStrictEqual(['client.posts']);
    expect([...schema.secured]).toStrictEqual(['client.posts']);
    expect(schema.foreignKeys.map(({ table }) => table)).toStrictEqual(['client.posts']);
    expect([...schema.indexed]).toStrictEqual([]);
});

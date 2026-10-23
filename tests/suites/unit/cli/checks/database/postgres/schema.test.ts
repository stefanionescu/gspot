import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type Migration } from '#cli/types/checks/postgres.ts';
import { parseSqlFile } from '#cli/parsers/code/sql/postgres.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';

import {
    KEYED_TABLES_SQL,
    RECREATED_TABLE_SQL,
    DROP_SECOND_INDEX_SQL,
    EQUIVALENT_INDEXES_SQL,
    INDEXED_TABLE_DROP_SQL,
    UNNAMED_FOREIGN_KEY_SQL,
    DROPPED_CONSTRAINTS_SQL,
} from '#tests/config/checks/database/postgres/schema.ts';

async function parseMigration(name: string, text: string): Promise<Migration> {
    const parsed = await parseSqlFile(text, createReadCache(process.cwd()));
    return { path: `migrations/${name}`, name, version: name.slice(0, 1), text, statements: parsed.statements };
}

test('keys count as indexes, a table constraint names its columns, and a dropped table leaves', async () => {
    const fields = buildSchema([
        await parseMigration('1_create.sql', KEYED_TABLES_SQL),
        await parseMigration('2_index.sql', INDEXED_TABLE_DROP_SQL),
    ]);
    expect(fields.tables.keys().toArray()).toStrictEqual(['public.posts']);
    expect(fields.foreignKeys.map((key) => `${key.table}.${key.column}`)).toStrictEqual([
        'public.posts.author_id',
        'public.posts.team_id',
    ]);
    expect(fields.indexed.get('public.posts')).toStrictEqual(new Set(['id', 'author_id']));
});

test('table recreation discards security, keys, and indexes from the old table', async () => {
    const fields = buildSchema([await parseMigration('1_reset.sql', RECREATED_TABLE_SQL)]);
    expect([...fields.tables.keys()]).toStrictEqual(['public.posts']);
    expect([...fields.secured]).toStrictEqual([]);
    expect([...fields.indexed]).toStrictEqual([]);
    expect(fields.foreignKeys.map((key) => key.column)).toStrictEqual(['author_id']);
});

test('removing one equivalent index preserves the other until it is removed, and disabling row security removes it', async () => {
    const initial = await parseMigration('1_create.sql', EQUIVALENT_INDEXES_SQL);
    const retained = buildSchema([initial]);
    expect(retained.indexed.get('public.posts')).toStrictEqual(new Set(['author_id']));
    const removed = buildSchema([initial, await parseMigration('2_drop.sql', DROP_SECOND_INDEX_SQL)]);
    expect([...removed.secured]).toStrictEqual([]);
    expect([...removed.indexed]).toStrictEqual([]);
});

test('dropped foreign and unique constraints remove only the fields they own', async () => {
    const initial = await parseMigration('1_keys.sql', DROPPED_CONSTRAINTS_SQL);
    const retained = buildSchema([initial]);
    expect(retained.foreignKeys.map((key) => key.column)).toStrictEqual(['team_id']);
    expect(retained.indexed.get('public.posts')).toStrictEqual(new Set(['author_id']));
    const removed = buildSchema([initial, await parseMigration('2_drop.sql', 'DROP INDEX author_index;')]);
    expect([...removed.indexed]).toStrictEqual([]);
});

test('an unnamed foreign key gets the PostgreSQL default name and does not count as an index', async () => {
    const initial = await parseMigration('1_keys.sql', UNNAMED_FOREIGN_KEY_SQL);
    const fields = buildSchema([initial]);
    expect(fields.foreignKeys.map(({ column }) => column)).toStrictEqual(['author_id']);
    expect(fields.indexed.get('public.posts')).toStrictEqual(new Set(['id', 'title']));
    const removed = buildSchema([
        initial,
        await parseMigration('2_drop.sql', 'ALTER TABLE posts DROP CONSTRAINT posts_author_id_fkey;'),
    ]);
    expect(removed.foreignKeys).toStrictEqual([]);
    expect(removed.indexed.get('public.posts')).toStrictEqual(new Set(['id', 'title']));
});

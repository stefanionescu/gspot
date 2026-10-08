import { test, expect } from 'bun:test';
import { parseMigration } from '#tests/harness/migrations.ts';
import { buildSchema } from '#cli/checks/database/postgres/contracts.ts';

test('keys count as indexes, a table constraint names its columns, and a dropped table leaves', async () => {
    const fields = buildSchema([
        await parseMigration(
            '1_create.sql',
            'CREATE TABLE posts (id UUID PRIMARY KEY, author_id UUID REFERENCES users (id), team_id UUID, CONSTRAINT team_fk FOREIGN KEY (team_id) REFERENCES teams (id));\nCREATE TABLE drafts (id UUID PRIMARY KEY, post_id UUID REFERENCES posts (id));',
        ),
        await parseMigration(
            '2_index.sql',
            'CREATE INDEX posts_author_idx ON posts (author_id, id);\nDROP TABLE drafts;',
        ),
    ]);
    expect(fields.tables.keys().toArray()).toStrictEqual(['public.posts']);
    expect(fields.foreignKeys.map((key) => `${key.table}.${key.column}`)).toStrictEqual([
        'public.posts.author_id',
        'public.posts.team_id',
    ]);
    expect(fields.indexed.get('public.posts')).toStrictEqual(new Set(['id', 'author_id']));
});

test('table recreation discards security, keys, and indexes from the old table', async () => {
    const fields = buildSchema([
        await parseMigration(
            '1_reset.sql',
            `
        CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id));
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        CREATE INDEX authors ON posts(author_id);
        DROP TABLE posts;
        CREATE TABLE posts (id int, author_id int REFERENCES users(id));
    `,
        ),
    ]);
    expect([...fields.tables.keys()]).toStrictEqual(['public.posts']);
    expect([...fields.secured]).toStrictEqual([]);
    expect([...fields.indexed]).toStrictEqual([]);
    expect(fields.foreignKeys.map((key) => key.column)).toStrictEqual(['author_id']);
});

test('removing one equivalent index preserves the other until it is removed', async () => {
    const initial = await parseMigration(
        '1_create.sql',
        `
        CREATE TABLE posts (author_id int REFERENCES users(id));
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        CREATE INDEX first ON posts(author_id);
        CREATE INDEX second ON posts(author_id);
        DROP INDEX first;
    `,
    );
    const retained = buildSchema([initial]);
    expect(retained.indexed.get('public.posts')).toStrictEqual(new Set(['author_id']));
    const removed = buildSchema([
        initial,
        await parseMigration(
            '2_drop.sql',
            `
        DROP INDEX second;
        ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
    `,
        ),
    ]);
    expect([...removed.secured]).toStrictEqual([]);
    expect([...removed.indexed]).toStrictEqual([]);
});

test('dropped foreign and unique constraints remove only the fields they own', async () => {
    const initial = await parseMigration(
        '1_keys.sql',
        `
        CREATE TABLE posts (author_id int, team_id int,
            CONSTRAINT author_fk FOREIGN KEY(author_id) REFERENCES users(id),
            CONSTRAINT team_fk FOREIGN KEY(team_id) REFERENCES teams(id),
            CONSTRAINT author_unique UNIQUE(author_id));
        CREATE INDEX author_index ON posts(author_id);
        ALTER TABLE posts DROP CONSTRAINT author_fk, DROP CONSTRAINT author_unique;
    `,
    );
    const retained = buildSchema([initial]);
    expect(retained.foreignKeys.map((key) => key.column)).toStrictEqual(['team_id']);
    expect(retained.indexed.get('public.posts')).toStrictEqual(new Set(['author_id']));
    const removed = buildSchema([initial, await parseMigration('2_drop.sql', 'DROP INDEX author_index;')]);
    expect([...removed.indexed]).toStrictEqual([]);
});

test('native unnamed foreign keys get their suffix without counting as their own index', async () => {
    const initial = await parseMigration(
        '1_keys.sql',
        'CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id), title text UNIQUE, CHECK (id > 0));',
    );
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

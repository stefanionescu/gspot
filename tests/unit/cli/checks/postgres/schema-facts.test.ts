import { describe, expect, test } from 'bun:test';
import { sqlFile } from '#cli/parsers/sql/statements.ts';
import type { Migration } from '#cli/checks/postgres/types.ts';
import { schemaFacts } from '#cli/checks/postgres/schema/facts.ts';

async function migration(name: string, text: string): Promise<Migration> {
    const parsed = await sqlFile(text);
    return { path: `migrations/${name}`, name, version: name.slice(0, 1), text, statements: parsed.statements };
}

describe('schemaFacts', () => {
    test('keys count as indexes, a table constraint names its columns, and a dropped table leaves', async () => {
        const facts = schemaFacts([
            await migration(
                '1_create.sql',
                'CREATE TABLE posts (id UUID PRIMARY KEY, author_id UUID REFERENCES users (id), team_id UUID, CONSTRAINT team_fk FOREIGN KEY (team_id) REFERENCES teams (id));\nCREATE TABLE drafts (id UUID PRIMARY KEY, post_id UUID REFERENCES posts (id));',
            ),
            await migration(
                '2_index.sql',
                'CREATE INDEX posts_author_idx ON posts (author_id, id);\nDROP TABLE drafts;',
            ),
        ]);
        expect(facts.tables.keys().toArray()).toStrictEqual(['public.posts']);
        expect(facts.foreignKeys.map((key) => `${key.table}.${key.column}`)).toStrictEqual([
            'public.posts.author_id',
            'public.posts.team_id',
        ]);
        expect(facts.indexed.get('public.posts')).toStrictEqual(new Set(['id', 'author_id']));
    });
});

test('table recreation discards security, policies, keys, and indexes from the old table', async () => {
    const facts = schemaFacts([
        await migration(
            '1_reset.sql',
            `
        CREATE TABLE posts (id int PRIMARY KEY, author_id int REFERENCES users(id));
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        CREATE POLICY readers ON posts USING (true);
        CREATE INDEX authors ON posts(author_id);
        DROP TABLE posts;
        CREATE TABLE posts (id int, author_id int REFERENCES users(id));
    `,
        ),
    ]);
    expect([...facts.tables.keys()]).toStrictEqual(['public.posts']);
    expect([...facts.secured]).toStrictEqual([]);
    expect([...facts.policed]).toStrictEqual([]);
    expect([...facts.indexed]).toStrictEqual([]);
    expect(facts.foreignKeys.map((key) => key.column)).toStrictEqual(['author_id']);
});

test('removing one policy or equivalent index preserves the other until it is removed', async () => {
    const initial = await migration(
        '1_create.sql',
        `
        CREATE TABLE posts (author_id int REFERENCES users(id));
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        CREATE POLICY first ON posts USING (true);
        CREATE POLICY second ON posts USING (true);
        CREATE INDEX first ON posts(author_id);
        CREATE INDEX second ON posts(author_id);
        DROP POLICY first ON posts;
        DROP INDEX first;
    `,
    );
    const retained = schemaFacts([initial]);
    expect(retained.policed.has('public.posts')).toBe(true);
    expect(retained.indexed.get('public.posts')).toStrictEqual(new Set(['author_id']));
    const removed = schemaFacts([
        initial,
        await migration(
            '2_drop.sql',
            `
        DROP POLICY second ON posts;
        DROP INDEX second;
        ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
    `,
        ),
    ]);
    expect([...removed.policed]).toStrictEqual([]);
    expect([...removed.secured]).toStrictEqual([]);
    expect([...removed.indexed]).toStrictEqual([]);
});

test('dropped foreign and unique constraints remove only the facts they own', async () => {
    const initial = await migration(
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
    const retained = schemaFacts([initial]);
    expect(retained.foreignKeys.map((key) => key.column)).toStrictEqual(['team_id']);
    expect(retained.indexed.get('public.posts')).toStrictEqual(new Set(['author_id']));
    const removed = schemaFacts([initial, await migration('2_drop.sql', 'DROP INDEX author_index;')]);
    expect([...removed.indexed]).toStrictEqual([]);
});

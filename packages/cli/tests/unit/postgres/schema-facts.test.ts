import { sqlFile } from '#cli/sql/statements.ts';
import { describe, expect, test } from 'bun:test';
import type { Migration } from '#types/postgres.ts';
import { schemaFacts } from '#cli/postgres/schema/facts.ts';

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
        expect(facts.tables.keys().toArray()).toEqual(['public.posts']);
        expect(facts.foreignKeys.map((key) => `${key.table}.${key.column}`)).toEqual([
            'public.posts.author_id',
            'public.posts.team_id',
        ]);
        expect(facts.indexed.get('public.posts')).toEqual(new Set(['id', 'author_id']));
    });
});

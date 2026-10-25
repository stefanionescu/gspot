import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { COMPOSITE_INDEX_CASES } from '#tests/config/checks/database/postgres/foreign-key-indexes.ts';

test.each([...COMPOSITE_INDEX_CASES])(
    'a composite foreign key with index ($columns) produces $count findings',
    async ({ columns, count }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['postgres'], { level: 'all' }),
            'migrations/1_orders.sql':
                'CREATE TABLE orders (tenant_id int, user_id int, id int, FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, user_id));\n' +
                `CREATE INDEX orders_lookup ON orders (${columns});\n`,
        });
        const findings = await runSandboxCheck(sandbox.path, 'postgres/foreign-key-indexes');
        expect(findings).toHaveLength(count);
        if (count > 0)
            expect(findings[0]).toMatchObject({
                file: 'migrations/1_orders.sql',
                rule: 'foreign-key-index',
                message: 'public.orders (tenant_id, user_id) is a foreign key and no index leads with these columns.',
            });
    },
);

test('foreign-key-indexes reports a foreign key column that no index leads with and passes after an index on it', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { level: 'all' }),
        'migrations/1_members.sql':
            'CREATE TABLE teams (id bigint PRIMARY KEY);\nCREATE TABLE members (id bigint PRIMARY KEY, team_id bigint REFERENCES teams (id));\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/foreign-key-indexes')).toStrictEqual([
        matchFields({
            file: 'migrations/1_members.sql',
            line: 2,
            rule: 'foreign-key-index',
            message: 'public.members (team_id) is a foreign key and no index leads with these columns.',
        }),
    ]);
    await writeFile(
        join(sandbox.path, 'migrations/2_index.sql'),
        'CREATE INDEX members_team_id ON members (team_id);\n',
    );
    expect(await runSandboxCheck(sandbox.path, 'postgres/foreign-key-indexes')).toStrictEqual([]);
});

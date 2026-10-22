import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { MEMBER_INDEX_SQL, MEMBER_TABLES_SQL } from '#tests/data/checks/postgres/foreign-key-indexes.ts';

test('foreign-key-indexes reports a foreign key column that no index leads with and passes after an index on it', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['postgres'], { level: 'all' }),
        'migrations/1_members.sql': MEMBER_TABLES_SQL,
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/foreign-key-indexes')).toStrictEqual([
        matchFields({
            file: 'migrations/1_members.sql',
            line: 2,
            rule: 'foreign-key-index',
            message: 'public.members.team_id is a foreign key and no index leads with it.',
        }),
    ]);
    await writeFile(join(sandbox.path, 'migrations/2_index.sql'), MEMBER_INDEX_SQL);
    expect(await runSandboxCheck(sandbox.path, 'postgres/foreign-key-indexes')).toStrictEqual([]);
});

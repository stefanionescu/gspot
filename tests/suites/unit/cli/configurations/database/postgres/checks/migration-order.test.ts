import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createMigrationHistory } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('migration-order reports a new migration older than a committed one and passes after it is renamed', async () => {
    await using sandbox = await createMigrationHistory();
    await writeFile(join(sandbox.path, 'migrations/20240101_early.sql'), 'SELECT 1;\n');
    runGitStep(sandbox.path, ['add', '.']);
    expect(await runSandboxCheck(sandbox.path, 'postgres/migration-order')).toStrictEqual([
        matchFields({
            file: 'migrations/20240101_early.sql',
            line: 1,
            rule: 'order',
            message: expect.stringContaining('20240201_teams.sql') as string,
        }),
    ]);
    runGitStep(sandbox.path, ['mv', 'migrations/20240101_early.sql', 'migrations/20240301_later.sql']);
    expect(await runSandboxCheck(sandbox.path, 'postgres/migration-order')).toStrictEqual([]);
});

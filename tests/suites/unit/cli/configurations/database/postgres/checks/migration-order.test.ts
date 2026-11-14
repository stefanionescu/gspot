import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox, createMigrationHistory } from '#tests/setup/sandboxes/repositories.ts';

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

test('a migration file without a version is reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres']),
        'migrations/init.sql': 'SELECT 1;\n',
        'migrations/1_a.sql': 'SELECT 1;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'postgres/migration-order');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'migrations/init.sql', line: 1, rule: 'version' },
    ]);
});

test('a second migration with the same version is reported and names the first', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['postgres']),
        'migrations/1_a.sql': 'SELECT 1;\n',
        'migrations/1_b.sql': 'SELECT 1;\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'postgres/migration-order')).toStrictEqual([
        matchFields({
            file: 'migrations/1_b.sql',
            rule: 'duplicate-version',
            message: expect.stringContaining('1_a.sql') as string,
        }),
    ]);
});

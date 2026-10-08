import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';

// Runs the pinned Squawk over the test migration with one generated configuration.

function squawk(root: string, config: string): SpawnOutcome {
    const result = runTestCommandBlocking(['squawk', '--reporter', 'json', '--config', config, 'migration.sql'], {
        cwd: root,
    });
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
}

test('Squawk uses the effective transaction setting for each scope and honors false under Supabase', async () => {
    await using sandbox = await testdir();
    const sample =
        "SET lock_timeout = '5s';\nSET statement_timeout = '30s';\nALTER TABLE public.teams ADD COLUMN size BIGINT;\n";
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['supabase'], {
            tables: '[tools.squawk]\nassume_in_transaction = false\n[scope."transactional"]\n[scope."transactional".tools.squawk]\nassume_in_transaction = true\n[scope."transactional/child"]\n',
        }),
        'migration.sql': sample,
        'supabase/migrations/0001_initial.sql': sample,
        'transactional/supabase/migrations/0001_initial.sql': 'SELECT 1;\n',
        'transactional/child/supabase/migrations/0001_initial.sql': 'SELECT 1;\n',
    });
    const session = await openSession(sandbox.path);
    const emitted = emitAll(session);
    const configs = emitted.files.filter(({ path }) => path.endsWith('/squawk.toml'));
    expect(
        Object.fromEntries(configs.map(({ path, content }) => [path, parse(content)['assume_in_transaction']])),
    ).toStrictEqual({
        '.gspot/config/squawk.toml': false,
        '.gspot/config/transactional/squawk.toml': true,
        '.gspot/config/transactional/child/squawk.toml': true,
    });
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, log, undefined, emitted);
    const transactional = squawk(sandbox.path, '.gspot/config/transactional/child/squawk.toml');
    expect(transactional.code, transactional.stderr).toBe(0);
    const failed = squawk(sandbox.path, '.gspot/config/squawk.toml');
    expect(failed.code, failed.stderr).toBe(1);
    expect(JSON.parse(failed.stdout)).toMatchObject([{ rule_name: 'prefer-robust-stmts' }]);
    await Bun.write(join(sandbox.path, 'migration.sql'), sample.replace('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '));
    const corrected = squawk(sandbox.path, '.gspot/config/squawk.toml');
    expect(corrected.code, corrected.stderr).toBe(0);
});

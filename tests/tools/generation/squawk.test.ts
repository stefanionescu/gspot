import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
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
    const defect =
        "SET lock_timeout = '5s';\nSET statement_timeout = '30s';\nALTER TABLE public.teams ADD COLUMN size BIGINT;\n";
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['supabase'], {
            tables: '[tools.squawk]\nassume_in_transaction = false\n[[scope]]\npath = "transactional"\n[scope.tools.squawk]\nassume_in_transaction = true\n[[scope]]\npath = "transactional/child"\n',
        }),
        'migration.sql': defect,
        'supabase/migrations/0001_initial.sql': defect,
        'transactional/supabase/migrations/0001_initial.sql': 'SELECT 1;\n',
        'transactional/child/supabase/migrations/0001_initial.sql': 'SELECT 1;\n',
    });
    const session = await openSession(sandbox.path);
    const rendered = emitAll(session);
    const configs = rendered.files.filter(({ path }) => path.endsWith('/squawk.toml'));
    expect(
        Object.fromEntries(configs.map(({ path, content }) => [path, parse(content)['assume_in_transaction']])),
    ).toStrictEqual({
        '.gspot/config/squawk.toml': false,
        '.gspot/config/transactional/squawk.toml': true,
        '.gspot/config/transactional/child/squawk.toml': true,
    });
    using log = openOwnership(sandbox.path);
    writeOutputs(session, log, undefined, rendered);
    const transactional = squawk(sandbox.path, '.gspot/config/transactional/child/squawk.toml');
    expect(transactional.code, transactional.stderr).toBe(0);
    const failed = squawk(sandbox.path, '.gspot/config/squawk.toml');
    expect(failed.code, failed.stderr).toBe(1);
    expect(JSON.parse(failed.stdout)).toMatchObject([{ rule_name: 'prefer-robust-stmts' }]);
    await Bun.write(join(sandbox.path, 'migration.sql'), defect.replace('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '));
    const corrected = squawk(sandbox.path, '.gspot/config/squawk.toml');
    expect(corrected.code, corrected.stderr).toBe(0);
});

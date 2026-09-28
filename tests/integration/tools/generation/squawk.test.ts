import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';

test('Squawk uses the effective transaction setting for each scope and honors false under Supabase', async () => {
    await using sandbox = await testdir();
    const defect =
        "SET lock_timeout = '5s';\nSET statement_timeout = '30s';\nALTER TABLE public.teams ADD COLUMN size BIGINT;\n";
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["supabase"]\n[tools.squawk]\nassume_in_transaction = false\n[[scope]]\npath = "transactional"\n[scope.tools.squawk]\nassume_in_transaction = true\n[[scope]]\npath = "transactional/child"\n',
        'migration.sql': defect,
        'transactional/child/migration.sql': 'SELECT 1;\n',
    });
    const session = await openSession(sandbox.path);
    const configs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(({ path }) => path.endsWith('/squawk.toml'));
    expect(
        Object.fromEntries(configs.map(({ path, content }) => [path, parse(content)['assume_in_transaction']])),
    ).toStrictEqual({
        '.gspot/config/squawk.toml': false,
        '.gspot/config/transactional/squawk.toml': true,
        '.gspot/config/transactional/child/squawk.toml': true,
    });
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    const transactional = Bun.spawnSync(
        ['squawk', '--config', '.gspot/config/transactional/child/squawk.toml', '--reporter', 'json', 'migration.sql'],
        {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        },
    );
    expect(transactional.exitCode, transactional.stderr.toString()).toBe(0);
    const failed = Bun.spawnSync(
        ['squawk', '--config', '.gspot/config/squawk.toml', '--reporter', 'json', 'migration.sql'],
        {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        },
    );
    expect(failed.exitCode, failed.stderr.toString()).toBe(1);
    expect(JSON.parse(failed.stdout.toString())).toMatchObject([{ rule_name: 'prefer-robust-stmts' }]);
    await Bun.write(join(sandbox.path, 'migration.sql'), defect.replace('ADD COLUMN ', 'ADD COLUMN IF NOT EXISTS '));
    const corrected = Bun.spawnSync(
        ['squawk', '--config', '.gspot/config/squawk.toml', '--reporter', 'json', 'migration.sql'],
        {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        },
    );
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
});

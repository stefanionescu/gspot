import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { emitAll } from '#cli/generation/render.ts';

import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';

test('SQLFluff honors root and nested dialect settings over the database default', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["postgres"]\n[tools.sqlfluff]\ndialect = "sqlite"\n[[scope]]\npath = "warehouse"\n[scope.tools.sqlfluff]\ndialect = "duckdb"\n[[scope]]\npath = "warehouse/child"\n',
        'query.sql': 'PRAGMA table_info (users);\n',
        'warehouse/child/query.sql': 'SELECT 1;\n',
    });
    const session = await openSession(sandbox.path);
    const configs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.filter((file) => file.path.endsWith('sqlfluff.cfg'));
    expect(
        Object.fromEntries(configs.map(({ path, content }) => [path, /^dialect = (.+)$/mu.exec(content)?.[1]])),
    ).toStrictEqual({
        '.gspot/config/sqlfluff.cfg': 'sqlite',
        '.gspot/config/warehouse/sqlfluff.cfg': 'duckdb',
        '.gspot/config/warehouse/child/sqlfluff.cfg': 'duckdb',
    });
    const config = configs.find((file) => file.path === '.gspot/config/sqlfluff.cfg')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const run = (dialect?: string) =>
        Bun.spawnSync(
            [
                'sqlfluff',
                'lint',
                '--config',
                config.path,
                '--ignore-local-config',
                '--rules',
                'LT01',
                ...(dialect === undefined ? [] : ['--dialect', dialect]),
                'query.sql',
            ],
            { cwd: sandbox.path, stdout: 'pipe', stderr: 'pipe' },
        );
    const wrong = run('postgres');
    expect(wrong.exitCode, wrong.stderr.toString()).toBe(1);
    expect(wrong.stdout.toString()).toContain('PRS');
    const corrected = run();
    expect(corrected.exitCode, corrected.stderr.toString()).toBe(0);
});

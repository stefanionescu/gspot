import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { emitted } from '#tests/harness/cli/generated.ts';

test('SQLFluff honors root and nested dialect settings over the database default', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['postgres'],
            '[tools.sqlfluff]\ndialect = "sqlite"\n[[scope]]\npath = "warehouse"\n[scope.tools.sqlfluff]\ndialect = "duckdb"\n[[scope]]\npath = "warehouse/child"\n',
        ),
        'query.sql': 'PRAGMA table_info (users);\n',
        'warehouse/child/query.sql': 'SELECT 1;\n',
    });
    const session = await openSession(sandbox.path);
    const configs = emitted(session).files.filter((file) => file.path.endsWith('sqlfluff.cfg'));
    expect(
        Object.fromEntries(configs.map(({ path, content }) => [path, /^dialect = (.+)$/mu.exec(content)?.[1]])),
    ).toStrictEqual({
        '.gspot/config/sqlfluff.cfg': 'sqlite',
        '.gspot/config/warehouse/sqlfluff.cfg': 'duckdb',
        '.gspot/config/warehouse/child/sqlfluff.cfg': 'duckdb',
    });
    const config = configs.find((file) => file.path === '.gspot/config/sqlfluff.cfg')!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Two native runs differ only in the dialect flag; one owner keeps the command line.
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

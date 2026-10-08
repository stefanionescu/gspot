import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { FOREIGN_DIALECT_CASES } from '#tests/config/cli/checks/language/sql.ts';
import { SQL_FUNCTION_SOURCE } from '#tests/config/tools/configurations/language/sql.ts';

test('SQLFluff honors root and nested dialect settings over the database default', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['postgres'], {
            tables: '[tools.sqlfluff]\ndialect = "sqlite"\n[scope."warehouse"]\n[scope."warehouse".tools.sqlfluff]\ndialect = "duckdb"\n[scope."warehouse/child"]\n',
        }),
        'query.sql': 'PRAGMA table_info (users);\n',
        'warehouse/query.sql': 'SELECT 1;\n',
        'warehouse/child/query.sql': 'SELECT * EXCLUDE (secret) FROM records;\n',
    });
    const session = await openSession(sandbox.path);
    const emitted = emitAll(session);
    const configs = emitted.files.filter((file) => file.path.endsWith('sqlfluff.cfg'));
    const config = configs.find((file) => file.path === '.gspot/config/sqlfluff.cfg')!;
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, emitted, log);
    const lint = ['sqlfluff', 'lint', '--config', config.path, '--ignore-local-config', '--rules', 'LT01'];
    const options = { cwd: sandbox.path };
    const wrong = await runTestCommand([...lint, '--dialect', 'postgres', 'query.sql'], options);
    expect(wrong.code, wrong.stderr).toBe(1);
    expect(wrong.stdout).toContain('PRS');
    const corrected = await runTestCommand([...lint, 'query.sql'], options);
    expect(corrected.code, corrected.stderr).toBe(0);
    const child = configs.find((file) => file.path === '.gspot/config/warehouse/child/sqlfluff.cfg')!;
    const nested = await runTestCommand(
        [
            'sqlfluff',
            'lint',
            '--config',
            child.path,
            '--ignore-local-config',
            '--rules',
            'LT01',
            'warehouse/child/query.sql',
        ],
        options,
    );
    expect(nested.code, `${nested.stdout}${nested.stderr}`).toBe(0);
    const wrongChild = await runTestCommand(
        [
            'sqlfluff',
            'lint',
            '--config',
            config.path,
            '--ignore-local-config',
            '--rules',
            'LT01',
            'warehouse/child/query.sql',
        ],
        options,
    );
    expect(wrongChild.code, `${wrongChild.stdout}${wrongChild.stderr}`).toBe(1);
    expect(wrongChild.stdout).toContain('PRS');
});

test.each(['recommended', 'all'] as const)(
    'SQLFluff at %s accepts valid block comments and still rejects malformed queries',
    async (level) => {
        await using sandbox = await testdir();
        const source = '/* Explains the query. */\nSELECT 1;\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['postgres'], { level }),
            'query.sql': source,
        });
        const session = await openSession(sandbox.path);
        const emitted = emitAll(session);
        const configuration = emitted.files.find(({ path }) => path === '.gspot/config/sqlfluff.cfg')!;
        using ownership = openOwnership(sandbox.path);
        writeGeneratedFiles(session, emitted, ownership);
        const parseArguments = ['parse', '--config', configuration.path, '--ignore-local-config', 'query.sql'];
        const accepted = await runTestCommand(['sqlfluff', ...parseArguments], { cwd: sandbox.path });
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'query.sql')).text()).toBe(source);
        await Bun.write(join(sandbox.path, 'query.sql'), '/* Explains the query. */\nSELECT FROM;\n');
        const failed = await runTestCommand(['sqlfluff', ...parseArguments], { cwd: sandbox.path });
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.stdout).toContain('PRS');
        await Bun.write(join(sandbox.path, 'query.sql'), source);
        const corrected = await runTestCommand(['sqlfluff', ...parseArguments], { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

test.each(FOREIGN_DIALECT_CASES)(
    'SQLFluff parses the $dialect sample that PostgreSQL rejects',
    async ({ dialect, source }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['sql'], { tables: `[tools.sqlfluff]\ndialect = "${dialect}"\n` }),
            'query.sql': source,
        });
        const session = await openSession(sandbox.path);
        const emitted = emitAll(session);
        const config = emitted.files.find(({ path }) => path === '.gspot/config/sqlfluff.cfg')!;
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, emitted, log);
        const lint = ['sqlfluff', 'lint', '--config', config.path, '--ignore-local-config', '--rules', 'LT01'];
        const options = { cwd: sandbox.path };
        const native = await runTestCommand([...lint, 'query.sql'], options);
        expect(native.code, native.stdout + native.stderr).toBe(0);
        const postgres = await runTestCommand([...lint, '--dialect', 'postgres', 'query.sql'], options);
        expect(postgres.code, postgres.stdout + postgres.stderr).toBe(1);
        expect(postgres.stdout).toContain('PRS');
    },
);

test.each(['recommended', 'all'] as const)(
    'SQLFluff at %s keeps function definitions and calls lowercase',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['postgres'], { level }),
            'functions.sql': SQL_FUNCTION_SOURCE,
        });
        const session = await openSession(sandbox.path);
        const emitted = emitAll(session);
        const config = emitted.files.find(({ path }) => path === '.gspot/config/sqlfluff.cfg')!;
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, emitted, log);
        const lintArguments = [
            '--config',
            config.path,
            '--ignore-local-config',
            '--rules',
            'CP02,CP03',
            'functions.sql',
        ];
        const options = { cwd: sandbox.path };
        const positive = await runTestCommand(['sqlfluff', 'lint', '--format', 'json', ...lintArguments], options);
        expect(positive.code, positive.stdout + positive.stderr).toBe(0);
        expect(JSON.parse(positive.stdout)).toMatchObject([{ filepath: 'functions.sql', violations: [] }]);
        await Bun.write(
            join(sandbox.path, 'functions.sql'),
            SQL_FUNCTION_SOURCE.replaceAll('get_user_name', 'GET_USER_NAME'),
        );
        const failed = await runTestCommand(['sqlfluff', 'lint', '--format', 'json', ...lintArguments], options);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(JSON.parse(failed.stdout)).toMatchObject([
            {
                filepath: 'functions.sql',
                violations: [
                    { code: 'CP03', start_line_no: 1, start_line_pos: 17 },
                    { code: 'CP03', start_line_no: 2, start_line_pos: 8 },
                ],
            },
        ]);
        const fixed = await runTestCommand(['sqlfluff', 'fix', '--force', ...lintArguments], options);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'functions.sql')).text()).toBe(SQL_FUNCTION_SOURCE);
        const corrected = await runTestCommand(['sqlfluff', 'lint', '--format', 'json', ...lintArguments], options);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(JSON.parse(corrected.stdout)).toMatchObject([{ filepath: 'functions.sql', violations: [] }]);
    },
);

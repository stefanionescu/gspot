import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { FOREIGN_DIALECT_CASES } from '#tests/config/sql.ts';

test('SQL and PL/pgSQL apply the statement limit and the parameter limit', async () => {
    const limit = 2;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['sql'], {
            tables: `[limits]\nmin_function_statements = ${String(limit)}\n[tools.sqlfluff]\ndialect = "postgres"\n`,
            level: 'all',
        }),
        'functions.sql': [
            String.raw`\set account '前言'`,
            'SELECT :account::int;',
            'CREATE FUNCTION one() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;',
            'CREATE FUNCTION two() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM 1; PERFORM 2; END $$;',
            'CREATE FUNCTION three() RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF true THEN PERFORM 1; PERFORM 2; END IF; END $$;',
            'CREATE FUNCTION seven(a int,b int,c int,d int,e int,f int,g int) RETURNS int LANGUAGE sql AS $$ SELECT a $$;',
            'CREATE FUNCTION eight(a int,b int,c int,d int,e int,f int,g int,h int) RETURNS int LANGUAGE sql AS $$ SELECT a $$;',
        ].join('\n'),
    });
    const result = await executeRun(await openSession(sandbox.path), buildRunOptions({ only: ['sql/functions'] }));
    const findings = result.report.checks.flatMap((check) => check.findings);
    expect(result.report.exitCode).toBe(1);
    expect(result.report.checks).toMatchObject([{ check: 'sql/functions', status: 'failed' }]);
    expect(
        findings
            .filter((finding) => finding.rule === 'trivial-function')
            .map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual(
        [3, 4, 6, 7].map((line) => ({
            file: 'functions.sql',
            line,
            rule: 'trivial-function',
        })),
    );
    expect(findings.filter((finding) => finding.rule === 'function-parameters')).toMatchObject([
        { check: 'sql/functions', file: 'functions.sql', line: 7, rule: 'function-parameters' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        settingsText(['sql'], {
            tables: '[limits.sql]\nfunction_parameters = { value = 8, reason = "The sandbox measures the boundary at eight parameters." }\n[tools.sqlfluff]\ndialect = "postgres"\n',
            level: 'all',
        }),
    );
    const overridden = await executeRun(await openSession(sandbox.path), buildRunOptions({ only: ['sql/functions'] }));
    expect(overridden.report.exitCode).toBe(1);
    expect(overridden.report.checks).toMatchObject([{ check: 'sql/functions', status: 'failed' }]);
    expect(
        overridden.report.checks
            .flatMap((check) => check.findings)
            .filter((finding) => finding.rule === 'function-parameters'),
    ).toStrictEqual([]);
});

test('SQL atomic bodies count each statement and reject files containing only trivial functions', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['sql'], { tables: '[tools.sqlfluff]\ndialect = "postgres"\n', level: 'all' }),
        'owner.sql':
            'CREATE FUNCTION substantial() RETURNS int LANGUAGE SQL BEGIN ATOMIC SELECT 1; SELECT 2; SELECT 3; END;',
        'wrapper.sql': 'CREATE FUNCTION wrapper() RETURNS int LANGUAGE SQL RETURN 1;',
    });
    const result = await executeRun(await openSession(sandbox.path), buildRunOptions({ only: ['sql/functions'] }));
    const findings = result.report.checks.flatMap((check) => check.findings);
    expect(findings.filter(({ file }) => file === 'owner.sql')).toStrictEqual([]);
    expect(
        findings
            .filter(({ file }) => file === 'wrapper.sql')
            .flatMap(({ rule }) => (rule === undefined ? [] : [rule]))
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['trivial-file', 'trivial-function']);
});

test('a function body that does not parse is an error, and the fixed body is checked', async () => {
    await using sandbox = await testdir();
    const source = "\\set label '前言'\nCREATE FUNCTION value() RETURNS int LANGUAGE sql AS $$ SELECT :value $$;\n";
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['sql'], { tables: '[tools.sqlfluff]\ndialect = "postgres"\n', level: 'all' }),
        'functions.sql': source,
    });
    const options = buildRunOptions({ only: ['sql/functions'] });
    const broken = await executeRun(await openSession(sandbox.path), options);
    expect(broken.report.checks[0]?.status).toBe('error');
    expect(broken.report.checks[0]?.note).toContain('Cannot analyze SQL function body');
    const corrected = source.replace('SELECT :value', 'SELECT 1');
    await Bun.write(`${sandbox.path}/functions.sql`, corrected);
    const checked = await executeRun(await openSession(sandbox.path), options);
    expect(
        checked.report.checks
            .flatMap(({ findings }) => findings)
            .map(({ rule, line, column }) => ({ rule, line, column })),
    ).toStrictEqual([
        { rule: 'trivial-function', line: 2, column: 1 },
        { rule: 'trivial-file', line: 1, column: undefined },
    ]);
});

test.each([...FOREIGN_DIALECT_CASES])(
    'the $dialect dialect bypasses PostgreSQL parsing',
    async ({ dialect, source }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['sql'], {
                tables: `[tools.sqlfluff]\ndialect = "${dialect}"\n`,
                level: 'all',
            }),
            'query.sql': source,
            'function.sql': 'CREATE FUNCTION value() RETURNS int LANGUAGE sql RETURN 1;\n',
        });
        const options = buildRunOptions({ only: ['sql/functions'] });
        const delegated = await executeRun(await openSession(sandbox.path), options);
        expect(delegated.report.exitCode).toBe(0);
        expect(
            delegated.report.checks.map(({ check, status, findings }) => ({ check, status, findings })),
        ).toStrictEqual([{ check: 'sql/functions', status: 'passed', findings: [] }]);
        await Bun.write(
            `${sandbox.path}/gspot.toml`,
            settingsText(['sql'], { tables: '[tools.sqlfluff]\ndialect = "postgres"\n', level: 'all' }),
        );
        const postgres = await executeRun(await openSession(sandbox.path), options);
        expect(postgres.report.exitCode).toBe(1);
        expect(postgres.report.checks).toMatchObject([
            {
                check: 'sql/functions',
                status: 'failed',
                fileCount: 2,
                findings: [
                    { file: 'function.sql', rule: 'trivial-function' },
                    { file: 'function.sql', rule: 'trivial-file' },
                ],
            },
        ]);
    },
);

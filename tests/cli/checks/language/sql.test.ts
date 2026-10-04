import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';

test('SQL and PL/pgSQL apply the statement threshold and the parameter limit', async () => {
    const threshold = 2;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['sql'], {
            tables: `[limits]\nmin_function_statements = ${String(threshold)}\n`,
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
        [...Array.from({ length: threshold }, (_, index) => index + 3), 6, 7].map((line) => ({
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
        buildPolicy(['sql'], { tables: '[limits.sql]\nfunction_parameters = 8\n', level: 'all' }),
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
        'gspot.toml': buildPolicy(['sql'], { level: 'all' }),
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

test('SQL function analysis keeps quoted bodies strict and preserves psql source bytes', async () => {
    await using sandbox = await testdir();
    const source = "\\set label '前言'\nCREATE FUNCTION value() RETURNS int LANGUAGE sql AS $$ SELECT :value $$;\n";
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['sql'], { level: 'all' }),
        'functions.sql': source,
    });
    const options = buildRunOptions({ only: ['sql/functions'] });
    const broken = await executeRun(await openSession(sandbox.path), options);
    expect(broken.report.checks[0]?.status).toBe('error');
    expect(await Bun.file(`${sandbox.path}/functions.sql`).text()).toBe(source);
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
    expect(await Bun.file(`${sandbox.path}/functions.sql`).text()).toBe(corrected);
});

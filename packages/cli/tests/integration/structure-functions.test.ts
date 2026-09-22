import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/run/session.ts';
import { executeRun } from '#cli/run/execute.ts';

for (const threshold of [1, 2, 3]) {
    test(`SQL and PL/pgSQL use statement threshold ${threshold} and seven input parameters`, async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\npresets = ["sql"]\n[limits]\ntrivial_statements = ${threshold}\n`,
            'functions.sql': [
                'CREATE FUNCTION one() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;',
                'CREATE FUNCTION two() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM 1; PERFORM 2; END $$;',
                'CREATE FUNCTION three() RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF true THEN PERFORM 1; PERFORM 2; END IF; END $$;',
                'CREATE FUNCTION seven(a int,b int,c int,d int,e int,f int,g int) RETURNS int LANGUAGE sql AS $$ SELECT a $$;',
                'CREATE FUNCTION eight(a int,b int,c int,d int,e int,f int,g int,h int) RETURNS int LANGUAGE sql AS $$ SELECT a $$;',
            ].join('\n'),
        });
        const result = await executeRun(await openSession(sandbox.path), {
            stage: 'all',
            skips: [],
            only: ['sql/functions'],
            fix: false,
            isDryRun: false,
        });
        const findings = result.report.checks.flatMap((check) => check.findings);
        expect(findings.filter((finding) => finding.rule === 'trivial-function')).toHaveLength(threshold + 2);
        expect(findings.filter((finding) => finding.rule === 'function-parameters')).toHaveLength(1);
        await Bun.write(
            `${sandbox.path}/gspot.toml`,
            `version = 1\npresets = ["sql"]\n[limits.sql]\nfunction_parameters = 8\n`,
        );
        const overridden = await executeRun(await openSession(sandbox.path), {
            stage: 'all',
            skips: [],
            only: ['sql/functions'],
            fix: false,
            isDryRun: false,
        });
        expect(
            overridden.report.checks
                .flatMap((check) => check.findings)
                .filter((finding) => finding.rule === 'function-parameters'),
        ).toEqual([]);
    });
}

test('SQL atomic bodies count each statement and reject files containing only trivial functions', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["sql"]\n',
        'owner.sql':
            'CREATE FUNCTION substantial() RETURNS int LANGUAGE SQL BEGIN ATOMIC SELECT 1; SELECT 2; SELECT 3; END;',
        'wrapper.sql': 'CREATE FUNCTION wrapper() RETURNS int LANGUAGE SQL RETURN 1;',
    });
    const result = await executeRun(await openSession(sandbox.path), {
        stage: 'all',
        skips: [],
        only: ['sql/functions'],
        fix: false,
        isDryRun: false,
    });
    const findings = result.report.checks.flatMap((check) => check.findings);
    expect(findings.filter(({ file }) => file === 'owner.sql')).toEqual([]);
    expect(
        findings
            .filter(({ file }) => file === 'wrapper.sql')
            .map(({ rule }) => rule)
            .sort(),
    ).toEqual(['trivial-file', 'trivial-function']);
});

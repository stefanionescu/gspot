import { expect, spyOn, test } from 'bun:test';
import { executeRun } from '#cli/run/execute.ts';
import { engineInput } from '#cli/run/engines.ts';
import { openSession } from '#cli/run/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { parserFor } from '#cli/parsers/tree-sitter.ts';
import { swiftSources } from '#cli/structure/swift/sources.ts';
import { pythonModules } from '#cli/structure/python/modules.ts';

for (const threshold of [1, 2, 3]) {
    test(`SQL and PL/pgSQL use statement threshold ${threshold} and seven input parameters`, async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nconfigurations = ["sql"]\n[limits]\ntrivial_statements = ${threshold}\n`,
            'functions.sql': [
                "\\set account '前言'",
                'SELECT :account::int;',
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
        expect(result.report.exitCode).toBe(1);
        expect(result.report.checks).toMatchObject([{ check: 'sql/functions', status: 'fail' }]);
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
            `version = 1\nconfigurations = ["sql"]\n[limits.sql]\nfunction_parameters = 8\n`,
        );
        const overridden = await executeRun(await openSession(sandbox.path), {
            stage: 'all',
            skips: [],
            only: ['sql/functions'],
            fix: false,
            isDryRun: false,
        });
        expect(overridden.report.exitCode).toBe(1);
        expect(overridden.report.checks).toMatchObject([{ check: 'sql/functions', status: 'fail' }]);
        expect(
            overridden.report.checks
                .flatMap((check) => check.findings)
                .filter((finding) => finding.rule === 'function-parameters'),
        ).toStrictEqual([]);
    });
}

test('SQL atomic bodies count each statement and reject files containing only trivial functions', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["sql"]\n',
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
    expect(findings.filter(({ file }) => file === 'owner.sql')).toStrictEqual([]);
    expect(
        findings
            .filter(({ file }) => file === 'wrapper.sql')
            .map(({ rule }) => rule)
            .sort(),
    ).toStrictEqual(['trivial-file', 'trivial-function']);
});

test.each([
    ['swift', 'swift', swiftSources],
    ['python', 'py', pythonModules],
] as const)('%s releases earlier trees when a later parse returns no tree', async (language, extension, read) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nconfigurations = ["${language}"]\n`,
        [`first.${extension}`]: language === 'swift' ? 'let first = 1' : 'first = 1',
        [`second.${extension}`]: language === 'swift' ? 'let second = 2' : 'second = 2',
    });
    const session = await openSession(sandbox.path);
    const request = engineInput(session, {
        scope: session.scopes[0]!,
        spec: session.manifests.get(language)!.checks[0]!,
        files: session.repository.files,
    });
    const parser = await parserFor(language);
    const original = parser.parse.bind(parser);
    const first = original(language === 'swift' ? 'let first = 1' : 'first = 1')!;
    const deleted = spyOn(first, 'delete');
    const parse = spyOn(parser, 'parse').mockReturnValueOnce(first).mockReturnValueOnce(null);
    try {
        await expect(read(request)).rejects.toThrow('parser returned no tree');
        expect(deleted).toHaveBeenCalledTimes(1);
    } finally {
        parse.mockRestore();
        deleted.mockRestore();
    }
    const corrected = await read(request);
    expect(corrected).toHaveLength(2);
    for (const source of corrected) source.tree.delete();
});

test('SQL function analysis keeps quoted bodies strict and preserves psql source bytes', async () => {
    await using sandbox = await testdir();
    const source = "\\set label '前言'\nCREATE FUNCTION value() RETURNS int LANGUAGE sql AS $$ SELECT :value $$;\n";
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["sql"]\n',
        'functions.sql': source,
    });
    const options = { stage: 'all' as const, skips: [], only: ['sql/functions'], fix: false, isDryRun: false };
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

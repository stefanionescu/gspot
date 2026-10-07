import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { containing } from '#tests/harness/expectations.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { planRun, ownedInputs } from '#cli/planning/plan.ts';
import { checkInput, runBuiltInCheck } from '#cli/execution/built-in.ts';
import { SOURCE_CORRECTIONS } from '#tests/config/cli/execution/check-input.ts';

test.each(SOURCE_CORRECTIONS)(
    '$language naming and structure read corrected source in a reused session',
    async ({ language, path, structural, defect, corrected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([language, 'naming'], { level: 'all' }),
            [path]: defect,
        });
        const session = await openSession(sandbox.path);
        const options = buildRunOptions({ only: ['naming/identifiers', structural], isDryRun: true });
        const failed = await executeRun(session, options);
        expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
        expect(failed.report.checks.map((check) => check.status)).toStrictEqual(['failed', 'failed']);
        for (const check of failed.report.checks)
            expect(check.findings).toContainEqual(containing({ file: path, line: 1 }));
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(defect);
        await Bun.write(join(sandbox.path, path), corrected);
        const accepted = await executeRun(session, options);
        expect(accepted.report.exitCode, JSON.stringify(accepted.report)).toBe(0);
        expect(accepted.report.checks).toMatchObject([
            { status: 'passed', findings: [] },
            { status: 'passed', findings: [] },
        ]);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(corrected);
    },
);

test('check inputs expose selected files and reserve the repository inventory for once-only checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['jest', 'docs'], { tables: '[[scope]]\npath = "apps/web"\n' }),
        'README.md': '# Repository\n',
        'apps/web/value.test.js': 'test("value", () => expect(1).toBe(1));\n',
        'apps/web/fixture.bin': new Uint8Array([0, 255, 0]),
        'apps/web/jest.config.json': '{"testEnvironment":"node"}',
        'unrelated/private.txt': 'Sibling input\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, {
        stage: 'all',
        skips: [],
        only: ['jest/coverage', 'docs/stale-paths'],
    });
    const project = planned.find(
        (entry) => entry.check.name === 'jest/coverage' && entry.scope.scope.path === 'apps/web',
    )!;
    const scopeInput = checkInput(session, project);
    const rootCheck = planned.find((entry) => entry.check.name === 'docs/stale-paths')!;
    const repositoryInput = checkInput(session, rootCheck);
    expect(repositoryInput.repositoryFiles).toBe(session.repository.files);
    for (const input of [scopeInput, repositoryInput]) expect(input.selections).toBe(session.scopes);
    expect(repositoryInput.repositoryFiles?.map((file) => file.path)).toContain('unrelated/private.txt');
    expect(ownedInputs(session, project).map((file) => file.path)).toStrictEqual(['apps/web/value.test.js']);
    expect(scopeInput.scopeRoot).toBe(join(sandbox.path, 'apps/web'));
    expect(
        scopeInput.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['apps/web/fixture.bin', 'apps/web/jest.config.json', 'apps/web/value.test.js']);
    const leaked = await executeRun(
        session,
        buildRunOptions({
            only: ['jest/coverage'],
            checks: {
                ...BUILT_IN_CHECKS,
                'jest/coverage': {
                    run: runBuiltInCheck(() => Promise.resolve({ findings: [], files: ['unrelated/private.txt'] })),
                },
            },
        }),
    );
    expect(leaked.report.exitCode).toBe(2);
    expect(leaked.report.checks).toMatchObject([{ status: 'error', findings: [] }]);
    expect(leaked.report.checks[0]!.note).toContain('unrelated/private.txt');
    const owned = await executeRun(
        session,
        buildRunOptions({
            only: ['jest/coverage'],
            checks: {
                ...BUILT_IN_CHECKS,
                'jest/coverage': {
                    run: runBuiltInCheck(() => Promise.resolve({ findings: [], files: ['apps/web/value.test.js'] })),
                },
            },
        }),
    );
    expect(owned.report.exitCode).toBe(0);
    expect(owned.report.checks).toMatchObject([{ status: 'passed', files: ['apps/web/value.test.js'] }]);
});

// Windows file names cannot hold a newline.
test.skipIf(!isPosix)('built-in checks read edited SQL source when a session is reused', async () => {
    await using sandbox = await testdir();
    const path = 'app/café\nquery.sql';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['sql'], {
            tables: '[tools.sqlfluff]\ndialect = "postgres"\n[[scope]]\npath = "app"\n',
            level: 'all',
        }),
        [path]: 'select 1;\n',
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({
        only: ['sql/trivial-functions', 'sql/file-lines'],
        isDryRun: true,
    });
    const clean = await executeRun(session, options);
    expect(clean.report.exitCode).toBe(0);
    expect(
        clean.report.checks
            .filter((check) => check.scope === 'app')
            .map((check) => check.check)
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['sql/file-lines', 'sql/trivial-functions']);
    await Bun.write(join(sandbox.path, path), 'CREATE FUNCTION value() RETURNS int LANGUAGE sql RETURN 1;\n');
    const defect = await executeRun(session, options);
    expect(defect.report.exitCode).toBe(1);
    expect(defect.report.checks.flatMap((check) => check.findings)).toContainEqual(containing({ file: path, line: 1 }));
    await Bun.write(join(sandbox.path, path), 'select 2;\n');
    const corrected = await executeRun(session, options);
    expect(corrected.report.exitCode).toBe(0);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe('select 2;\n');
});

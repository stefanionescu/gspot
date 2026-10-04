import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { containing } from '#tests/harness/expectations.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { planRun, ownedInputs } from '#cli/execution/planning/plan.ts';
import { SOURCE_CORRECTIONS } from '#tests/config/cli/execution/engine-input.ts';

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

test('engine inputs expose selected files and reserve the repository inventory for once-only checks', async () => {
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
        (entry) => entry.spec.name === 'jest/coverage' && entry.scope.scope.path === 'apps/web',
    )!;
    const scopeInput = engineInput(session, project);
    const rootCheck = planned.find((entry) => entry.spec.name === 'docs/stale-paths')!;
    const repositoryInput = engineInput(session, rootCheck);
    expect(repositoryInput.repositoryFiles).toBe(session.repository.files);
    expect(repositoryInput.selections).toBe(session.scopes);
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
                ...CHECKS,
                'jest/coverage': { engine: () => Promise.resolve({ findings: [], files: ['unrelated/private.txt'] }) },
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
                ...CHECKS,
                'jest/coverage': { engine: () => Promise.resolve({ findings: [], files: ['apps/web/value.test.js'] }) },
            },
        }),
    );
    expect(owned.report.exitCode).toBe(0);
    expect(owned.report.checks).toMatchObject([{ status: 'passed', files: ['apps/web/value.test.js'] }]);
});

// Windows file names cannot hold a newline.
test.skipIf(!isPosix)('engines read edited SQL source when a session is reused', async () => {
    await using sandbox = await testdir();
    const path = 'app/café\nquery.sql';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['sql'], { tables: '[[scope]]\npath = "app"\n', level: 'all' }),
        [path]: 'select 1;\n',
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({
        only: ['sql/syntax', 'sql/block-comments', 'sql/file-lines'],
        isDryRun: true,
    });
    const clean = await executeRun(session, options);
    expect(clean.report.exitCode).toBe(0);
    expect(
        clean.report.checks
            .filter((check) => check.scope === 'app')
            .map((check) => check.check)
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['sql/block-comments', 'sql/file-lines', 'sql/syntax']);
    await Bun.write(join(sandbox.path, path), 'select from;\n');
    const defect = await executeRun(session, options);
    expect(defect.report.exitCode).toBe(1);
    expect(defect.report.checks.flatMap((check) => check.findings)).toContainEqual(containing({ file: path, line: 1 }));
    await Bun.write(join(sandbox.path, path), 'select 2;\n');
    const corrected = await executeRun(session, options);
    expect(corrected.report.exitCode).toBe(0);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe('select 2;\n');
});

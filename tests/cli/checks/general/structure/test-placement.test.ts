import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';

import {
    TEST_FILES,
    HARNESS_SOURCES,
    ASSERTION_SOURCES,
} from '#tests/config/cli/checks/general/structure/test-placement.ts';

const options = buildRunOptions({ only: ['structure/test-placement'] });

test('test placement preserves test siblings, declarations, and the declared harness', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...TEST_FILES,
        'gspot.toml': buildPolicy(['typescript'], {
            level: 'all',
            tables: '[architecture.roles]\ntest_harness = "tests/support"\n',
        }),
    });
    const result = await executeRun(await openSession(sandbox.path), options);
    expect(
        result.report.checks.flatMap((check) => check.findings.map(({ file, rule }) => ({ file, rule }))),
    ).toStrictEqual([
        { file: 'tests/custom/factory.ts', rule: 'misplaced' },
        { file: 'tests/mocks/factory.ts', rule: 'misplaced' },
        { file: 'tests/unit/builders.ts', rule: 'misplaced' },
    ]);
});

test.each(ASSERTION_SOURCES)('imported framework assertions belong beside tests: %s', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            level: 'all',
            tables: '[architecture.roles]\ntest_harness = "tests/support"\n',
        }),
        'tests/unit/a.test.ts': '',
        'tests/unit/assertions.ts': code,
    });
    const result = await executeRun(await openSession(sandbox.path), options);
    expect(result.report.exitCode).toBe(0);
});

test.each(HARNESS_SOURCES)('matcher data and unrelated or shadowed bindings remain support: %s', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            level: 'all',
            tables: '[architecture.roles]\ntest_harness = "tests/support"\n',
        }),
        'tests/unit/a.test.ts': '',
        'tests/unit/builders.ts': code,
    });
    const result = await executeRun(await openSession(sandbox.path), options);
    expect(result.report.checks.flatMap((check) => check.findings)).toMatchObject([
        {
            file: 'tests/unit/builders.ts',
            rule: 'misplaced',
            message: 'builders.ts is not a test but sits beside tests. Move it to tests/support.',
        },
    ]);
});

test('a custom harness owns its support and absence of a harness produces no finding', async () => {
    for (const tables of ['', '[architecture.roles]\ntest_harness = "tests/custom"\n']) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript'], { level: 'all', tables }),
            'tests/custom/a.test.ts': '',
            'tests/custom/factory.ts': '',
        });
        const result = await executeRun(await openSession(sandbox.path), options);
        expect(result.report.exitCode).toBe(0);
    }
});

test('NestJS spec files and Jest test directories keep their native framework layout', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['nestjs', 'jest'], {
            level: 'all',
            tables: '[architecture.roles]\ntest_harness = "test/harness"\n',
        }),
        'src/orders.service.ts': '',
        'src/orders.service.spec.ts': '',
        '__tests__/orders.test.ts': '',
        '__tests__/orders.d.ts': '',
        'test/harness/setup.ts': '',
    });
    const result = await executeRun(await openSession(sandbox.path), options);
    expect(result.report.exitCode).toBe(0);
});

test('root and child test placement use scope-owned files and normalized harness paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            level: 'all',
            tables: '[architecture.roles]\ntest_harness = "tests/support"\n[scope.api]\nconfigurations = ["typescript"]\n[scope.api.architecture.roles]\ntest_harness = "tests/harness"\n',
        }),
        'tests/unit/a.test.ts': '',
        'tests/unit/builders.ts': '',
        'api/tests/unit/a.spec.ts': '',
        'api/tests/unit/builders.ts': '',
        'api/tests/harness/setup.ts': '',
    });
    const result = await executeRun(await openSession(sandbox.path), options);
    expect(
        result.report.checks.map(({ scope, findings }) => ({ scope, paths: findings.map((finding) => finding.file) })),
    ).toStrictEqual([
        { scope: '', paths: ['tests/unit/builders.ts'] },
        { scope: 'api', paths: ['api/tests/unit/builders.ts'] },
    ]);
    expect(result.report.checks[1]?.findings[0]?.message).toBe(
        'builders.ts is not a test but sits beside tests. Move it to api/tests/harness.',
    );
});

test('test placement keeps reviewed ignores and remains an all-level convention', async () => {
    for (const level of ['all', 'recommended'] as const) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: '[architecture.roles]\ntest_harness = "tests/support"\n[[ignore]]\ncheck = "structure/test-placement"\npaths = ["tests/unit/builders.ts"]\nreason = "The reviewed fixture needs adjacent setup."\n',
            }),
            'tests/unit/a.test.ts': '',
            'tests/unit/builders.ts': '',
        });
        const result = await executeRun(await openSession(sandbox.path), options);
        expect(result.report.exitCode).toBe(0);
    }
});

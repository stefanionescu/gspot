// One installed Next.js project: its type check, the framework rules the configuration requires, the delegation of
// type checking to the Next.js check, and the i18n rules.
import { z } from 'zod';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { getTsconfig } from '#cli/parsers/packages/public.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import { createReadCache } from '#cli/platform/root/public.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { installedModules } from '#tests/harness/environment.ts';
import nextManifest from 'next/package.json' with { type: 'json' };
import { prepareTestRepository } from '#tests/harness/repository.ts';
import reactManifest from 'react/package.json' with { type: 'json' };
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { NEXT_PAGE, NEXT_LAYOUT } from '#tests/config/samples/nextjs.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import reactDomManifest from 'react-dom/package.json' with { type: 'json' };
import type { TestRepository, InstalledScenario } from '#tests/types/harness/repository.ts';

import {
    COUNT,
    CASES,
    PACKAGE,
    REPOSITORY,
    BUILD_FAILURE,
    REFERENCE_PROJECT_FILES,
} from '#tests/config/tools/configurations/framework/nextjs.ts';

// Runs the named checks alone, expects the exit code, and returns the report.
async function checked(repository: TestRepository, checks: string[], code: number): Promise<RunReport> {
    // The Next.js type check runs the type generation and then the compiler, which is slow on Windows.
    const outcome = await spawnGspot(
        repository.root,
        ['check', '--only', ...checks, '--json'],
        repository.environment,
        {},
    );
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(code);
    return JSON.parse(outcome.stdout) as RunReport;
}

// Type checking delegates to the Next.js check only when that check runs.
async function delegation(repository: TestRepository): Promise<void> {
    const direct = await checked(repository, ['typescript/tsc'], 0);
    expect(direct.checks).toMatchObject([{ check: 'typescript/tsc', status: 'passed' }]);
    const delegated = await checked(repository, ['typescript/tsc', 'nextjs/tsc'], 0);
    expect(delegated.checks.find(({ check }) => check === 'nextjs/tsc')?.status).toBe('passed');
    expect(delegated.checks.find(({ check }) => check === 'typescript/tsc')).toMatchObject({
        status: 'skipped',
        note: 'nextjs/tsc runs it here',
    });
}

// The TypeScript check still reports findings when the Next.js check is skipped.
async function skippedReplacement(repository: TestRepository): Promise<void> {
    const path = join(repository.root, 'app/count.ts');
    const checks = ['typescript/tsc', 'nextjs/tsc', '--skip', 'nextjs/tsc'];
    await writeFile(path, COUNT);
    try {
        const failed = await checked(repository, checks, 1);
        expect(failed.checks.find(({ check }) => check === 'typescript/tsc')).toMatchObject({
            status: 'failed',
            findings: [{ check: 'typescript/tsc', file: 'app/count.ts', rule: 'TS2322', line: 4 }],
        });
        expect(failed.skips.some(({ check, cause }) => check === 'nextjs/tsc' && cause === 'flag')).toBe(true);
        await writeFile(path, COUNT.replace('"three"', '3'));
        await checked(repository, checks, 0);
    } finally {
        await rm(path);
    }
}

// The i18n rules reject literal markup, and the corrected layout passes. A page component of one statement passes
// too, because the React configuration lets components be that small.
async function literalMarkup(repository: TestRepository): Promise<void> {
    const layout = join(repository.root, 'app/layout.tsx');
    // Text written into the markup is what the i18n rule exists for, and a rule that runs proves its plugin works.
    await Bun.write(layout, NEXT_LAYOUT.replace('<body>{children}</body>', '<body>Welcome{children}</body>'));
    try {
        const literal = await checked(repository, ['javascript/eslint'], 1);
        expect(literal.checks[0]!.findings).toContainEqual(
            containing({ rule: 'i18next/no-literal-string', file: 'app/layout.tsx', line: 13 }),
        );
    } finally {
        await Bun.write(layout, NEXT_LAYOUT);
    }
    const corrected = await checked(repository, ['javascript/eslint'], 0);
    expect(corrected.checks[0]!.findings).toStrictEqual([]);
}

// The level alone selects native build enforcement, and isolated output preserves authored inputs.
async function buildLevels(repository: TestRepository): Promise<void> {
    const { root, environment } = repository;
    const page = join(root, 'app/page.tsx');
    const policy = await Bun.file(join(root, 'gspot.toml')).text();
    const compiler = await Bun.file(join(root, 'tsconfig.json')).text();
    await Bun.write(page, BUILD_FAILURE);
    try {
        const failed = await checked(repository, ['nextjs/build'], 1);
        expect(failed.checks).toMatchObject([
            { check: 'nextjs/build', status: 'failed', findings: [{ rule: 'build' }] },
        ]);
        expect(failed.checks[0]!.findings[0]!.message).toContain('Build failed because of webpack errors');
        const recommended = await spawnGspot(root, ['set', 'level', 'recommended'], environment);
        expect(recommended.code, recommended.stdout + recommended.stderr).toBe(0);
        const omitted = await checked(repository, ['nextjs/build'], 0);
        expect(omitted.checks).toStrictEqual([]);
        await Bun.write(page, NEXT_PAGE);
        const all = await spawnGspot(root, ['set', 'level', 'all'], environment);
        expect(all.code, all.stdout + all.stderr).toBe(0);
        const passed = await checked(repository, ['nextjs/build'], 0);
        expect(passed.checks).toMatchObject([{ check: 'nextjs/build', status: 'passed', findings: [] }]);
        expect(await Bun.file(join(root, 'tsconfig.json')).text()).toBe(compiler);
        expect(await Bun.file(join(root, 'gspot.toml')).text()).toBe(policy);
    } finally {
        await Bun.write(page, NEXT_PAGE);
        await Bun.write(join(root, 'gspot.toml'), policy);
        await spawnGspot(root, ['apply'], environment);
    }
}

const resources = new AsyncDisposableStack();
let testRepository: TestRepository;
beforeAll(async () => {
    const scenario: InstalledScenario = {
        ...REPOSITORY,
        files: {
            ...REPOSITORY.files,
            'package.json':
                JSON.stringify(
                    {
                        ...PACKAGE,
                        dependencies: {
                            next: nextManifest.version,
                            ...PACKAGE.dependencies,
                            react: reactManifest.version,
                            'react-dom': reactDomManifest.version,
                        },
                    },
                    null,
                    4,
                ) + '\n',
        },
    };
    // Webpack needs the sandbox and linked dependencies on one drive, so it sits beside the checkout.
    const sandbox = resources.use(
        await testdir({}, { dirname: join(installedModules, '../..', `gspot-test-${randomUUID()}`) }),
    );
    const environment = await prepareTestRepository(sandbox.path, scenario);
    testRepository = { root: sandbox.path, environment, run: spawnGspot };
});
afterAll(async () => {
    await resources.disposeAsync();
});

describe('the nextjs configuration', () => {
    test('type checking delegates to the Next.js check only when it runs', () => delegation(testRepository));
    test('the TypeScript check reports findings when the Next.js check is skipped', () =>
        skippedReplacement(testRepository));
    test('all builds the app without an enabling flag and recommended omits the build', () =>
        buildLevels(testRepository));
    test('the i18n rules reject literal markup', () => literalMarkup(testRepository));
    for (const entry of structuredClone(CASES)) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        test(`${entry.check} reports ${where} and passes after the fix`, async () => {
            const { failed, passed } = await runFindingCase(testRepository, entry, REPOSITORY);
            const { message, ...position } = entry.expected;
            expect(failed.code, `${entry.check}: ${failed.stdout}${failed.stderr}`).toBe(1);
            expect(failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
            expect(failed.report.checks[0]?.findings).toContainEqual(
                containing({
                    check: entry.check,
                    ...position,
                    ...(message === undefined ? {} : { message: textContaining(message) }),
                }),
            );
            expect(passed.code, `${entry.check} corrected: ${passed.stdout}${passed.stderr}`).toBe(0);
            expect(passed.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
        });
    }
});

test('Next.js generates types and compiles references without a second copy or source output', async () => {
    const { root } = testRepository;
    const compiler = await Bun.file(join(root, 'tsconfig.json')).text();
    const parsed = getTsconfig(root, join(root, 'tsconfig.json'), createReadCache(root))!.raw;
    const authored = JSON.stringify({
        ...parsed,
        references: [{ path: './compiler-ref' }],
        exclude: [...z.array(z.string()).parse(parsed['exclude'] ?? []), 'compiler-ref/**'],
    });
    await createFileTree(root, REFERENCE_PROJECT_FILES);
    await Bun.write(join(root, 'tsconfig.json'), authored);
    try {
        const failed = await checked(testRepository, ['nextjs/tsc'], 1);
        expect(failed.checks).toMatchObject([{ check: 'nextjs/tsc', status: 'failed' }]);
        expect(failed.checks[0]!.findings).toContainEqual(
            containing({
                file: 'compiler-ref/source.ts',
                rule: 'TS2322',
                line: 1,
                column: 14,
            }),
        );
        await Bun.write(join(root, 'compiler-ref/source.ts'), 'export const value: number = 1;\n');
        const passed = await checked(testRepository, ['nextjs/tsc'], 0);
        expect(passed.checks).toMatchObject([{ check: 'nextjs/tsc', status: 'passed', findings: [] }]);
        expect(await Bun.file(join(root, 'tsconfig.json')).text()).toBe(authored);
        expect(await Bun.file(join(root, 'compiler-ref/tsconfig.json')).text()).toBe(
            REFERENCE_PROJECT_FILES['compiler-ref/tsconfig.json'],
        );
        expect(await Bun.file(join(root, 'compiler-ref/dist/source.js')).exists()).toBe(false);
        expect(await Bun.file(join(root, 'compiler-ref/tsconfig.tsbuildinfo')).exists()).toBe(false);
    } finally {
        await Bun.write(join(root, 'tsconfig.json'), compiler);
        await rm(join(root, 'compiler-ref'), { recursive: true });
    }
});

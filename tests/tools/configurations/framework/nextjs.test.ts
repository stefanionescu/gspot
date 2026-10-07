// One installed Next.js project: its type check, the framework rules the configuration requires, the delegation of
// type checking to the Next.js check, and the i18n rules.
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { rmSync, chmodSync, writeFileSync } from 'node:fs';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { installedModules } from '#tests/harness/environment.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { NEXT_PAGE, NEXT_LAYOUT } from '#tests/config/samples/nextjs.ts';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import { CASES, COUNT, REPOSITORY, BUILD_FAILURE } from '#tests/config/tools/configurations/framework/nextjs.ts';
import type { TestRepository, RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';

// Runs the named checks alone, expects the exit code, and returns the report.
async function checked(repository: TestRepository, checks: string[], code: number): Promise<RunReport> {
    // The Next.js type check runs the type generation and then the compiler, which is slow on Windows.
    const outcome = await spawnGspot(
        repository.root,
        ['check', '--only', ...checks, '--json'],
        repository.environment,
        { timeoutMs: NATIVE_TEST_TIMEOUT_MS },
    );
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(code);
    return JSON.parse(outcome.stdout) as RunReport;
}

// The framework rules reject a disabled requirement and accept its restoration.
async function requiredRules(repository: TestRepository): Promise<void> {
    const config = join(repository.root, '.gspot/config/eslint.config.mjs');
    const written = await Bun.file(config).text();
    await checked(repository, ['javascript/rules-off'], 0);
    chmodSync(config, OWNER_WRITABLE_FILE);
    // A later block that turns a required rule off is what javascript/rules-off exists to see.
    const disabled = written.replace('"react/no-danger":"error"', '"react/no-danger":"off"');
    expect(disabled).not.toBe(written);
    await Bun.write(config, disabled);
    try {
        const seen = await checked(repository, ['javascript/rules-off'], 1);
        expect(seen.checks[0]!.findings).toContainEqual(
            containing({
                file: '.gspot/config/eslint.config.mjs',
                rule: 'rule-off',
                line: 1,
                message:
                    'Enable react/no-danger for 2 files (app/layout.tsx, app/page.tsx). The react configuration requires this rule.',
            }),
        );
    } finally {
        await Bun.write(config, written);
    }
    await checked(repository, ['javascript/rules-off'], 0);
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

// The TypeScript check still finds defects when the Next.js check is skipped.
async function skippedReplacement(repository: TestRepository): Promise<void> {
    const path = join(repository.root, 'app/count.ts');
    const checks = ['typescript/tsc', 'nextjs/tsc', '--skip', 'nextjs/tsc'];
    writeFileSync(path, COUNT);
    try {
        const failed = await checked(repository, checks, 1);
        expect(failed.checks.find(({ check }) => check === 'typescript/tsc')).toMatchObject({
            status: 'failed',
            findings: [{ check: 'typescript/tsc', file: 'app/count.ts', rule: 'TS2322', line: 4 }],
        });
        expect(failed.skips.some(({ check, cause }) => check === 'nextjs/tsc' && cause === 'flag')).toBe(true);
        writeFileSync(path, COUNT.replace('"three"', '3'));
        await checked(repository, checks, 0);
    } finally {
        rmSync(path);
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

const repository: RepositoryScenario = {
    ...REPOSITORY,
    dirname: join(installedModules, '../..', `gspot-test-${randomUUID()}`),
};
const resources = new AsyncDisposableStack();
let testRepository: OwnedTestRepository;
beforeAll(async () => {
    const budget = openTestBudget(suiteTimeout());
    try {
        testRepository = resources.use(await createTestRepository(repository, spawnGspot));
        const configured = await spawnGspot(
            testRepository.root,
            ['set', 'tools.next.build_flags', '--', '--webpack'],
            testRepository.environment,
        );
        expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    } finally {
        budget[Symbol.dispose]();
    }
}, suiteTimeout());
afterAll(async () => {
    await resources.disposeAsync();
});

describe('the nextjs configuration', () => {
    for (const entry of CASES) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                const { failed: outcome, passed: correction } = await runFindingCase(testRepository, entry, repository);
                expect(outcome.code, `${entry.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
                expect(outcome.report.checks[0]?.findings).toContainEqual(
                    containing({ check: entry.check, ...entry.expected }),
                );
                expect(correction.code, `${entry.check} corrected: ${correction.stdout}${correction.stderr}`).toBe(0);
                expect(correction.report.checks).toMatchObject([
                    { check: entry.check, status: 'passed', findings: [] },
                ]);
            },
            suiteTimeout(),
        );
    }

    test(
        'the framework rules reject a disabled requirement',
        () => requiredRules(testRepository),
        NATIVE_TEST_TIMEOUT_MS,
    );
    test(
        'type checking delegates to the Next.js check only when it runs',
        () => delegation(testRepository),
        NATIVE_TEST_TIMEOUT_MS,
    );
    test(
        'the TypeScript check finds defects when the Next.js check is skipped',
        () => skippedReplacement(testRepository),
        NATIVE_TEST_TIMEOUT_MS,
    );
    test(
        'all builds the app without an enabling flag and recommended omits the build',
        () => buildLevels(testRepository),
        NATIVE_TEST_TIMEOUT_MS,
    );
    test('the i18n rules reject literal markup', () => literalMarkup(testRepository), NATIVE_TEST_TIMEOUT_MS);
});

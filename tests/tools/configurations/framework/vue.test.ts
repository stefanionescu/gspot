// One installed Vue repository: the shared rules inside component scripts, the style block, and the type check that
// takes over tsc. A JavaScript repository with both component configurations skips the Vue type check.
import { testdir } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import vueManifest from 'vue/package.json' with { type: 'json' };
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import { runCheckCase, runFindingCase } from '#tests/harness/check-case.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, REPOSITORY } from '#tests/config/tools/configurations/framework/vue.ts';
import { createTestRepository, prepareTestRepository } from '#tests/harness/repository.ts';

describe('the vue configuration', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(REPOSITORY, spawnGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });
    for (const entry of CASES) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                const { failed: outcome, passed: correction } = await runFindingCase(testRepository, entry, REPOSITORY);
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
        'vue/tsc takes over typescript/tsc',
        async () => {
            const { root, environment } = testRepository;
            const both = await spawnGspot(
                root,
                ['check', '--json', '--only', 'typescript/tsc', 'vue/tsc'],
                environment,
            );
            expect(both.code, both.stdout + both.stderr).toBe(0);
            expect((JSON.parse(both.stdout) as RunReport).checks).toContainEqual(
                containing({ check: 'typescript/tsc', status: 'skipped', note: 'vue/tsc runs it here' }),
            );
        },
        NATIVE_TEST_TIMEOUT_MS,
    );
});

test(
    'a JavaScript repository skips the Vue type check, keeps the Svelte warnings, and applies the shared rules',
    async () => {
        await using sandbox = await testdir();
        const environment = await prepareTestRepository(sandbox.path, {
            configurations: ['javascript', 'vue', 'svelte'],
            dependencies: { vue: vueManifest.version, svelte: '5.57.0' },
            files: {
                'src/build.js': 'export const build = (value) => value + 1;',
                'src/Greeting.vue':
                    '<script setup>\ndefineProps({ name: { type: String, required: true } });\ndefineEmits(["submitted"]);\n</script>\n\n<template>\n    <p>{{ name }}</p>\n</template>\n',
                'src/Product.svelte': '<script>\n    let { source } = $props();\n</script>\n\n<img src={source} />\n',
            },
        });
        const outcome = await runCheckCase(
            sandbox.path,
            {
                check: 'javascript/eslint',
                files: {
                    'src/SharedPolicy.vue': '<script>\nfunction forward(value) { return build(value); }\n</script>\n',
                },
            },
            environment,
        );
        const lint = (JSON.parse(outcome.stdout) as RunReport).checks.flatMap(({ findings }) => findings);
        expect(lint).toContainEqual(
            containing({ rule: 'gspot/no-trivial-functions', file: 'src/SharedPolicy.vue', line: 2 }),
        );
        expect(lint.map(({ rule }) => rule)).not.toContain('@typescript-eslint/no-explicit-any');
        expect(lint.map(({ rule }) => rule)).not.toContain('vue/define-props-declaration');
        expect(lint.map(({ rule }) => rule)).not.toContain('vue/define-emits-declaration');
        const result = await spawnGspot(
            sandbox.path,
            ['check', '--json', '--only', 'vue/tsc', 'svelte/check'],
            environment,
        );
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const report = JSON.parse(result.stdout) as RunReport;
        expect(report.checks).toContainEqual(
            containing({
                check: 'vue/tsc',
                status: 'skipped',
                note: 'Needs the typescript configuration, which this scope does not select.',
            }),
        );
        expect(report.checks.find(({ check }) => check === 'svelte/check')?.findings).toContainEqual(
            containing({ rule: 'a11y_missing_attribute', file: 'src/Product.svelte', line: 5 }),
        );
    },
    NATIVE_TEST_TIMEOUT_MS,
);

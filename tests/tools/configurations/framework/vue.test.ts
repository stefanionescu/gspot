// One installed Vue repository: the shared rules inside component scripts, the style block, and the type check that
// takes over tsc. A JavaScript repository with both component configurations skips the Vue type check.
import { testdir } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runCheckCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget, runTestCommand } from '#tests/harness/command.ts';
import { createTestRepository, prepareTestRepository } from '#tests/harness/repository.ts';
import { REPOSITORY, VUE_VERSION } from '#tests/config/tools/configurations/framework/vue.ts';
import type { RepositoryScenario, OwnedTestRepository } from '#tests/types/harness/repository.ts';

const repository: RepositoryScenario = {
    ...REPOSITORY,
    prepare: async (root) => {
        const installed = await runTestCommand(['bun', 'install'], { cwd: root });
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    },
};

describe('the vue configuration', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(repository, spawnGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });

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
            modules: false,
            configurations: ['javascript', 'vue', 'svelte'],
            dependencies: { vue: VUE_VERSION, svelte: '5.57.0' },
            files: {
                'src/build.js': 'export const build = (value) => value + 1;',
                'src/Greeting.vue':
                    '<script setup>\ndefineProps({ name: { type: String, required: true } });\ndefineEmits(["submitted"]);\n</script>\n\n<template>\n    <p>{{ name }}</p>\n</template>\n',
                'src/Product.svelte': '<script>\n    let { source } = $props();\n</script>\n\n<img src={source} />\n',
            },
        });
        const installed = await runTestCommand(['bun', 'install'], { cwd: sandbox.path });
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
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

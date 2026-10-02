// One installed Vue repository: the shared rules inside component scripts, the style block, and the type check that
// takes over tsc. A JavaScript repository with both component kits skips the Vue type check.
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import vueManifest from 'vue/package.json' with { type: 'json' };
import type { RunReport } from '#cli/types/execution/execution.ts';
import { installSandbox } from '#tests/harness/planted/sandbox.ts';
import { runPlanted, plantedCases } from '#tests/harness/planted/cases.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG } from '#tests/samples/components.ts';

const VUE_CLEAN =
    '<script setup lang="ts">\ndefineProps<{ name: string }>();\n</script>\n\n<template>\n    <p>{{ name }}</p>\n</template>\n';

const CARD =
    '<template>\n    <p class="card"><span class="title">card</span></p>\n</template>\n\n<style scoped>\n.card :deep(.title) {\n    color: #ggg;\n}\n</style>\n';

const COUNT =
    '<script setup lang="ts">\nconst count: number = \'one\';\n</script>\n\n<template>\n    <p>{{ count }}</p>\n</template>\n';

plantedCases(
    'the vue kit',
    {
        kits: ['typescript', 'vue', 'css'],
        dependencies: { vue: vueManifest.version },
        files: {
            'tsconfig.json': COMPONENT_TSCONFIG,
            'src/answer.ts': COMPONENT_SOURCE,
            'src/env.d.ts': "import 'vue';\n",
            'src/UserGreeting.vue': VUE_CLEAN,
        },
    },
    [
        {
            // The shared TypeScript rules reach the component script.
            check: 'javascript/eslint',
            files: {
                'src/SharedPolicy.vue':
                    '<script lang="ts">\nfunction forward(value: any) { return build(value); }\n</script>\n',
            },
            expected: { file: 'src/SharedPolicy.vue', rule: 'gspot/no-trivial-functions', line: 2 },
            corrected: {
                files: {
                    'src/SharedPolicy.vue':
                        '<script setup lang="ts">\nconst answer = 42;\n</script>\n<template><p>{{ answer }}</p></template>\n',
                },
            },
        },
        {
            // Stylelint reads the style block and knows the scoping pseudo-class of Vue.
            check: 'css/stylelint',
            files: { 'src/Card.vue': CARD },
            expected: { file: 'src/Card.vue', rule: 'declaration-property-value-no-unknown', line: 7 },
            corrected: { files: { 'src/Card.vue': CARD.replace('#ggg', '#abc') } },
        },
        {
            check: 'vue/tsc',
            files: { 'src/Count.vue': COUNT },
            expected: { file: 'src/Count.vue', rule: 'TS2322', line: 2 },
            corrected: { files: { 'src/Count.vue': COUNT.replace("'one'", '1') } },
        },
    ],
    (installed) => {
        test(
            'vue/tsc takes over typescript/tsc',
            async () => {
                const { root, environment } = installed();
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
            PLANTED_TIMEOUT_MS * 2,
        );
    },
);

test(
    'a JavaScript repository skips the Vue type check, keeps the Svelte warnings, and applies the shared rules',
    async () => {
        await using sandbox = await testdir();
        const environment = await installSandbox(sandbox.path, {
            kits: ['javascript', 'vue', 'svelte'],
            dependencies: { vue: vueManifest.version, svelte: '5.57.0' },
            files: {
                'src/build.js': 'export const build = (value) => value + 1;',
                'src/Greeting.vue':
                    '<script setup>\ndefineProps({ name: { type: String, required: true } });\n</script>\n\n<template>\n    <p>{{ name }}</p>\n</template>\n',
                'src/Product.svelte': '<script>\n    let { source } = $props();\n</script>\n\n<img src={source} />\n',
            },
        });
        const outcome = await runPlanted(
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
                note: 'needs the typescript configuration, which this scope does not select',
            }),
        );
        expect(report.checks.find(({ check }) => check === 'svelte/check')?.findings).toContainEqual(
            containing({ rule: 'a11y_missing_attribute', file: 'src/Product.svelte', line: 5 }),
        );
    },
    PLANTED_TIMEOUT_MS * 6,
);

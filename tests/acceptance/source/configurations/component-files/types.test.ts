// Planted type errors in component files: vue-tsc and svelte-check report them and take over the TypeScript check, and a JavaScript scope skips the Vue check and keeps the Svelte warnings.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import { installSandbox } from '#tests/support/cli/sandbox.ts';
import vueManifest from 'vue/package.json' with { type: 'json' };
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG, PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';

const SHAPES = [
    {
        framework: 'vue',
        check: 'vue/typecheck',
        dependencies: { vue: vueManifest.version },
        path: 'src/Count.vue',
        planted:
            '<script setup lang="ts">\nconst count: number = \'one\';\n</script>\n\n<template>\n    <p>{{ count }}</p>\n</template>\n',
    },
    {
        framework: 'svelte',
        check: 'svelte/check',
        dependencies: { svelte: '5.57.0' },
        path: 'src/Count.svelte',
        planted: '<script lang="ts">\n    const count: number = \'one\';\n</script>\n\n<p>{count}</p>\n',
    },
];

describe('component type checking', () => {
    test.each(SHAPES)(
        '$check reports a type error in $path and takes over typescript/tsc',
        async ({ framework, check, dependencies, path, planted }) => {
            await using sandbox = await testdir();
            const environment = await installSandbox(sandbox.path, {
                configurations: ['typescript', framework],
                dependencies,
                files: {
                    'tsconfig.json': COMPONENT_TSCONFIG,
                    'src/answer.ts': COMPONENT_SOURCE,
                    ...(framework === 'vue' ? { 'src/env.d.ts': "import 'vue';\n" } : {}),
                },
            });
            const outcome = await runPlanted(sandbox.path, { check, files: { [path]: planted } }, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const report = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(report.checks[0]!.findings).toContainEqual(containing({ rule: 'TS2322', file: path, line: 2 }));
            await Bun.write(join(sandbox.path, path), planted.replace("'one'", '1'));
            const both = await run(
                sandbox.path,
                ['check', '--no-cache', '--json', '--only', 'typescript/tsc', check],
                environment,
            );
            expect(both.code, both.stdout + both.stderr).toBe(0);
            const corrected = reportSchema.parse(JSON.parse(both.stdout));
            expect(corrected.checks).toContainEqual(containing({ check, status: 'ok', findings: [] }));
            expect(corrected.checks).toContainEqual(
                containing({ check: 'typescript/tsc', status: 'skipped', note: `${check} runs it here` }),
            );
        },
        PLANTED_TIMEOUT_MS * 6,
    );

    test(
        'a JavaScript scope skips the Vue type check and keeps the Svelte compiler warnings',
        async () => {
            await using sandbox = await testdir();
            const dependencies = { vue: vueManifest.version, svelte: '5.57.0' };
            const environment = await installSandbox(sandbox.path, {
                configurations: ['javascript', 'vue', 'svelte'],
                dependencies,
                files: {
                    'src/Greeting.vue':
                        '<script setup>\ndefineProps({ name: { type: String, required: true } });\n</script>\n\n<template>\n    <p>{{ name }}</p>\n</template>\n',
                    'src/Product.svelte':
                        '<script>\n    let { source } = $props();\n</script>\n\n<img src={source} />\n',
                },
            });
            const result = await run(
                sandbox.path,
                ['check', '--no-cache', '--json', '--only', 'vue/typecheck', 'svelte/check'],
                environment,
            );
            expect(result.code, result.stdout + result.stderr).toBe(1);
            const report = reportSchema.parse(JSON.parse(result.stdout));
            expect(report.checks).toContainEqual(
                containing({
                    check: 'vue/typecheck',
                    status: 'skipped',
                    note: 'needs the typescript configuration, which this scope does not select',
                }),
            );
            expect(report.checks.find((entry) => entry.check === 'svelte/check')?.findings).toContainEqual(
                containing({ rule: 'a11y_missing_attribute', file: 'src/Product.svelte', line: 5 }),
            );
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});

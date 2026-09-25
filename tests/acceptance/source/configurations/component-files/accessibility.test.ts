// Planted accessibility defects in component files: an image with no text alternative, which the Vue plugin and svelte-check report.
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import vueManifest from 'vue/package.json' with { type: 'json' };
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG, installSandbox } from '#tests/support/cli/sandbox.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';

const SHAPES = [
    {
        framework: 'vue',
        check: 'vue/eslint',
        rule: 'vuejs-accessibility/alt-text',
        dependencies: { vue: vueManifest.version },
        path: 'src/ProductPhoto.vue',
        planted:
            '<script setup lang="ts">\ndefineProps<{ source: string }>();\n</script>\n\n<template>\n    <img :src="source" />\n</template>\n',
        line: 6,
    },
    {
        framework: 'svelte',
        check: 'svelte/check',
        rule: 'a11y_missing_attribute',
        dependencies: { svelte: '5.57.0' },
        path: 'src/Product.svelte',
        planted:
            '<script lang="ts">\n    const { source }: { source: string } = $props();\n</script>\n\n<img src={source} />\n',
        line: 5,
    },
];

describe('component accessibility', () => {
    test.each(SHAPES)(
        '$check reports $rule and accepts a text alternative',
        async ({ framework, check, rule, dependencies, path, planted, line }) => {
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
            expect(report.checks[0]!.findings).toContainEqual(expect.objectContaining({ rule, file: path, line }));
            const corrected = planted.replace(
                framework === 'vue' ? ':src="source"' : 'src={source}',
                framework === 'vue' ? ':src="source" alt="The product"' : 'src={source} alt="The product"',
            );
            await Bun.write(join(sandbox.path, path), corrected);
            const fixed = await run(sandbox.path, ['check', '--only', check, '--no-cache', '--json'], environment);
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(fixed.stdout)).checks).toMatchObject([
                { check, status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});

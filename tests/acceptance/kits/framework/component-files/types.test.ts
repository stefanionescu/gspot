// Component type checks report planted errors and own TypeScript checking. JavaScript scopes skip Vue type checks but retain Svelte warnings.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runPlanted } from '#tests/harness/planted/cases.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import vueManifest from 'vue/package.json' with { type: 'json' };
import type { RunReport } from '#cli/types/execution/execution.ts';
import { installSandbox } from '#tests/harness/planted/sandbox.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG } from '#tests/samples/components.ts';

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

test.each(SHAPES)(
    'component type checking > $check reports a type error in $path and takes over typescript/tsc',
    async ({ framework, check, dependencies, path, planted }) => {
        await using sandbox = await testdir();
        const environment = await installSandbox(sandbox.path, {
            kits: ['typescript', framework],
            dependencies,
            files: {
                'tsconfig.json': COMPONENT_TSCONFIG,
                'src/answer.ts': COMPONENT_SOURCE,
                ...(framework === 'vue' ? { 'src/env.d.ts': "import 'vue';\n" } : {}),
            },
        });
        const outcome = await runPlanted(sandbox.path, { check, files: { [path]: planted } }, environment);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        const report = JSON.parse(outcome.stdout) as RunReport;
        expect(report.checks[0]!.findings).toContainEqual(containing({ rule: 'TS2322', file: path, line: 2 }));
        await Bun.write(join(sandbox.path, path), planted.replace("'one'", '1'));
        const both = await spawnGspot(
            sandbox.path,
            ['check', '--json', '--only', 'typescript/tsc', check],
            environment,
        );
        expect(both.code, both.stdout + both.stderr).toBe(0);
        const corrected = JSON.parse(both.stdout) as RunReport;
        expect(corrected.checks).toContainEqual(containing({ check, status: 'ok', findings: [] }));
        expect(corrected.checks).toContainEqual(
            containing({ check: 'typescript/tsc', status: 'skipped', note: `${check} runs it here` }),
        );
    },
    PLANTED_TIMEOUT_MS * 6,
);

test(
    'component type checking > a JavaScript scope skips the Vue type check and keeps the Svelte compiler warnings',
    async () => {
        await using sandbox = await testdir();
        const dependencies = { vue: vueManifest.version, svelte: '5.57.0' };
        const environment = await installSandbox(sandbox.path, {
            kits: ['javascript', 'vue', 'svelte'],
            dependencies,
            files: {
                'src/Greeting.vue':
                    '<script setup>\ndefineProps({ name: { type: String, required: true } });\n</script>\n\n<template>\n    <p>{{ name }}</p>\n</template>\n',
                'src/Product.svelte': '<script>\n    let { source } = $props();\n</script>\n\n<img src={source} />\n',
            },
        });
        const result = await spawnGspot(
            sandbox.path,
            ['check', '--json', '--only', 'vue/typecheck', 'svelte/check'],
            environment,
        );
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const report = JSON.parse(result.stdout) as RunReport;
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

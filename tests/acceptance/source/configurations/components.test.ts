import { join } from 'node:path';
import { testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { runPlanted } from '#tests/support/cli/planted.ts';
import vueManifest from 'vue/package.json' with { type: 'json' };
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
// Planted repositories for the vue and svelte configurations: markup set from a string and a list with no key, in each framework, and the shared JavaScript and TypeScript rules inside component scripts.
import { reportSchema, type RunReport } from '#cli/execution/report.ts';
import { COMPONENT_SOURCE, COMPONENT_TSCONFIG, installSandbox } from '#tests/support/cli/sandbox.ts';

/** One framework of component files in the planted components test: its check, its configurations, its files and its planted cases. */
type ComponentShape = {
    check: string;
    configurations: string[];
    dependencies: Record<string, string>;
    files: Record<string, string>;
    planted: string;
    cases: [string, string][];
};

const VUE_CLEAN =
    '<script setup lang="ts">\ndefineProps<{ name: string }>();\n</script>\n\n<template>\n    <p>{{ name }}</p>\n</template>\n';
const VUE_CASES: [string, string][] = [
    [
        'vue/no-v-html',
        '<script setup lang="ts">\ndefineProps<{ html: string }>();\n</script>\n\n<template>\n    <div v-html="html"></div>\n</template>\n',
    ],
    [
        'vue/require-v-for-key',
        '<script setup lang="ts">\ndefineProps<{ names: string[] }>();\n</script>\n\n<template>\n    <ul>\n        <li v-for="name in names">{{ name }}</li>\n    </ul>\n</template>\n',
    ],
];

const SVELTE_CLEAN =
    '<script lang="ts">\n    const { name }: { name: string } = $props();\n</script>\n\n<p>{name}</p>\n';
const SVELTE_CASES: [string, string][] = [
    [
        'svelte/no-at-html-tags',
        '<script lang="ts">\n    const { html }: { html: string } = $props();\n</script>\n\n<div>{@html html}</div>\n',
    ],
    [
        'svelte/require-each-key',
        '<script lang="ts">\n    const { names }: { names: string[] } = $props();\n</script>\n\n<ul>\n    {#each names as name}\n        <li>{name}</li>\n    {/each}\n</ul>\n',
    ],
];

const SHAPES: ComponentShape[] = [
    {
        check: 'vue/eslint',
        configurations: ['typescript', 'vue'],
        dependencies: { vue: vueManifest.version },
        files: { 'src/UserGreeting.vue': VUE_CLEAN, 'src/env.d.ts': "import 'vue';\n" },
        planted: 'src/PlantedExample.vue',
        cases: VUE_CASES,
    },
    {
        check: 'svelte/eslint',
        configurations: ['typescript', 'svelte'],
        dependencies: { svelte: '5.57.0' },
        files: { 'src/Greeting.svelte': SVELTE_CLEAN },
        planted: 'src/Planted.svelte',
        cases: SVELTE_CASES,
    },
];

describe('the vue and svelte configurations', () => {
    for (const shape of SHAPES)
        test.each(shape.cases)(
            `${shape.check} reports %s and accepts a corrected component`,
            async (rule, text) => {
                await using sandbox = await testdir();
                const environment = await installSandbox(sandbox.path, {
                    configurations: shape.configurations,
                    dependencies: shape.dependencies,
                    files: { 'tsconfig.json': COMPONENT_TSCONFIG, 'src/answer.ts': COMPONENT_SOURCE, ...shape.files },
                });
                const clean = await run(
                    sandbox.path,
                    ['check', '--only', shape.check, '--no-cache', '--json'],
                    environment,
                );
                expect(clean.code, clean.stdout + clean.stderr).toBe(0);
                expect(reportSchema.parse(JSON.parse(clean.stdout)).checks).toMatchObject([
                    { check: shape.check, status: 'ok', files: 1, findings: [] },
                ]);
                const outcome = await runPlanted(
                    sandbox.path,
                    { check: shape.check, files: { [shape.planted]: text } },
                    environment,
                );
                expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
                const report = reportSchema.parse(
                    await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
                );
                expect(report.checks).toMatchObject([{ check: shape.check, status: 'fail' }]);
                expect(report.checks[0]!.findings).toContainEqual(
                    expect.objectContaining({
                        rule,
                        file: shape.planted,
                        line: {
                            'vue/no-v-html': 6,
                            'vue/require-v-for-key': 7,
                            'svelte/no-at-html-tags': 5,
                            'svelte/require-each-key': 6,
                        }[rule]!,
                    }),
                );
                await Bun.write(
                    join(sandbox.path, shape.planted),
                    shape.check === 'vue/eslint' ? VUE_CLEAN : SVELTE_CLEAN,
                );
                const corrected = await run(
                    sandbox.path,
                    ['check', '--only', shape.check, '--no-cache', '--json'],
                    environment,
                );
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                    { check: shape.check, status: 'ok', findings: [] },
                ]);
                const code = await run(
                    sandbox.path,
                    ['check', '--only', 'typescript/eslint', '--no-cache'],
                    environment,
                );
                expect(code.code, code.stdout + code.stderr).toBe(0);
                const required = await run(
                    sandbox.path,
                    ['check', '--only', 'integrity/required-rules', '--no-cache'],
                    environment,
                );
                expect(required.code, required.stdout + required.stderr).toBe(0);
            },
            PLANTED_TIMEOUT_MS * 6,
        );
});

test.each([
    ['vue', 'javascript'],
    ['svelte', 'javascript'],
    ['vue', 'typescript'],
    ['svelte', 'typescript'],
])(
    '%s applies shared %s rules inside component scripts',
    async (framework, language) => {
        const filename = `src/SharedPolicy.${framework}`;
        const before =
            language === 'typescript'
                ? '<script lang="ts">\nfunction forward(value: any) { return build(value); }\n</script>\n'
                : '<script>\nfunction forward(value) { return build(value); }\n</script>\n';
        await using sandbox = await testdir();
        const environment = await installSandbox(sandbox.path, {
            configurations: [framework, language],
            dependencies: framework === 'vue' ? { vue: vueManifest.version } : { svelte: '5.57.0' },
            files: {
                // A module in the language under test; a TypeScript file would select the typescript configuration.
                ...(language === 'typescript'
                    ? {
                          'tsconfig.json': COMPONENT_TSCONFIG,
                          'src/build.ts': 'export const build = (value: number): number => value + 1;',
                      }
                    : { 'src/build.js': 'export const build = (value) => value + 1;' }),
                [filename]: before,
            },
        });
        const args = ['check', '--only', `${framework}/eslint`, '--no-cache', '--json'];
        const broken = await run(sandbox.path, args, environment);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const report = JSON.parse(broken.stdout) as RunReport;
        expect(
            report.checks
                .flatMap((check) => check.findings)
                .filter((finding) => finding.rule === 'gspot/no-trivial-functions')
                .map(({ check, rule, file, line, column }) => ({ check, rule, file, line, column })),
            broken.stdout + broken.stderr,
        ).toStrictEqual([
            { check: `${framework}/eslint`, rule: 'gspot/no-trivial-functions', file: filename, line: 2, column: 1 },
        ]);
        // The typed component also reports its explicit any; the plain one has no type rules.
        const explicitAny = report.checks
            .flatMap((check) => check.findings)
            .find((finding) => finding.rule === '@typescript-eslint/no-explicit-any');
        expect(
            explicitAny === undefined ? undefined : { file: explicitAny.file, line: explicitAny.line },
        ).toStrictEqual(language === 'typescript' ? { file: filename, line: 2 } : undefined);
        await Bun.write(
            join(sandbox.path, filename),
            `<script${framework === 'vue' ? ' setup' : ''}${language === 'typescript' ? ' lang="ts"' : ''}>\nconst answer = 42;\n</script>\n` +
                (framework === 'vue' ? '<template><p>{{ answer }}</p></template>\n' : '<p>{answer}</p>\n'),
        );
        const corrected = await run(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
            { check: `${framework}/eslint`, status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 2,
);

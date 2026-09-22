import { symlinkSync } from 'node:fs';
// Planted repositories for the vue and svelte presets: markup set from a string and a list with no key, in each framework.
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import type { RunReport } from '#cli/output/report-types.ts';
import { describe, expect, test } from 'bun:test';
import type { ComponentShape } from '#tests/types/acceptance.ts';
import vueManifest from 'vue/package.json' with { type: 'json' };
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
const init = (presets: string[]): string[] => [
    'init',
    '--yes',
    '--presets',
    ...presets,
    '--without',
    'naming',
    'spelling',
    'css',
    'vitest',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const manifest = (name: string, version: string): string =>
    `{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "${name}": "${version}"\n    }\n}\n`;
const TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n';
const SOURCE = '// A value the planted files build on.\n\n/** The answer. */\nexport const answer = 42;\n';

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
        presets: ['typescript', 'vue'],
        files: {
            'package.json': manifest('vue', vueManifest.version),
            'src/UserGreeting.vue': VUE_CLEAN,
            'src/env.d.ts': "import 'vue';\n",
        },
        planted: 'src/PlantedExample.vue',
        cases: VUE_CASES,
    },
    {
        check: 'svelte/eslint',
        presets: ['typescript', 'svelte'],
        files: { 'package.json': manifest('svelte', '5.57.0'), 'src/Greeting.svelte': SVELTE_CLEAN },
        planted: 'src/Planted.svelte',
        cases: SVELTE_CASES,
    },
];

describe('the vue and svelte presets', () => {
    for (const shape of SHAPES)
        test(
            `${shape.check} reads a component file and fires on its planted defects`,
            async () => {
                await using sandbox = await testdir();
                await createFileTree(sandbox.path, {
                    '.gitignore': 'node_modules\n',
                    'tsconfig.json': TSCONFIG,
                    'src/answer.ts': SOURCE,
                    ...shape.files,
                });
                symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
                commitAll(sandbox.path);
                const environment = {
                    PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
                };
                await install(sandbox.path, init(shape.presets), environment);
                const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
                expect(selected.code, selected.stdout + selected.stderr).toBe(0);
                const clean = await run(sandbox.path, ['check', '--only', shape.check, '--no-cache'], environment);
                expect(clean.code, clean.stdout + clean.stderr).toBe(0);
                expect(clean.stdout).toContain('1 file');
                for (const [rule, text] of shape.cases) {
                    const outcome = await runPlanted(
                        sandbox.path,
                        { check: shape.check, files: { [shape.planted]: text } },
                        environment,
                    );
                    expect(outcome.code, `${rule}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                    expect(outcome.stdout, rule).toContain(rule);
                }
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
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "all"\npresets = ["${framework}", "${language}"]\n`,
            'package.json': '{"name":"component-policy","private":true,"type":"module"}',
            'tsconfig.json': '{ "compilerOptions": { "strict": true }, "include": ["src"] }\n',
            'src/build.ts': 'export const build = (value: number): number => value + 1;',
            [filename]: before,
        });
        symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const args = ['check', '--only', `${framework}/eslint`, '--no-cache', '--json'];
        const broken = await run(sandbox.path, args);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const report = JSON.parse(broken.stdout) as RunReport;
        expect(
            report.checks
                .flatMap((check) => check.findings)
                .filter((finding) => finding.rule === 'gspot/no-trivial-functions')
                .map(({ check, rule, file, line, column }) => ({ check, rule, file, line, column })),
            broken.stdout + broken.stderr,
        ).toEqual([
            { check: `${framework}/eslint`, rule: 'gspot/no-trivial-functions', file: filename, line: 2, column: 1 },
        ]);
        if (language === 'typescript')
            expect(
                report.checks
                    .flatMap((check) => check.findings)
                    .find((finding) => finding.rule === '@typescript-eslint/no-explicit-any'),
            ).toMatchObject({ file: filename, line: 2 });
        await Bun.write(
            join(sandbox.path, filename),
            before.replace('build(value)', 'build(value + 1)').replace('value: any', 'value: number'),
        );
        const corrected = await run(sandbox.path, args);
        expect([0, 1]).toContain(corrected.code);
        const after = JSON.parse(corrected.stdout) as RunReport;
        expect(after.checks).toHaveLength(1);
        expect(after.checks[0]?.status).toMatch(/^(?:ok|fail)$/u);
        expect(
            after.checks
                .flatMap((check) => check.findings)
                .filter(
                    (finding) =>
                        finding.rule === 'gspot/no-trivial-functions' ||
                        finding.rule === '@typescript-eslint/no-explicit-any',
                ),
        ).toEqual([]);
    },
    PLANTED_TIMEOUT_MS,
);

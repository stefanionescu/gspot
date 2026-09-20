import { symlinkSync } from 'node:fs';
// Planted repositories for the vue and svelte presets: markup set from a string and a list with no key, in each framework.
import { delimiter, join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import type { ComponentShape } from '#types/run.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
const init = (presets: string): string[] => [
    'init',
    '--yes',
    '--presets',
    presets,
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
const TSCONFIG = '{\n    "extends": "./.gspot/tsconfig.base.json",\n    "include": ["src"]\n}\n';
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
        presets: 'typescript,vue',
        files: { 'package.json': manifest('vue', '3.5.22'), 'src/Greeting.vue': VUE_CLEAN },
        planted: 'src/Planted.vue',
        cases: VUE_CASES,
    },
    {
        check: 'svelte/eslint',
        presets: 'typescript,svelte',
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
                await using sandbox = await createSandbox({
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
                const clean = await run(sandbox.path, ['check', '--only', shape.check, '--no-cache'], environment);
                expect(clean.code, clean.stdout + clean.stderr).toBe(0);
                expect(clean.stdout).toContain('1 file');
                for (const [rule, text] of shape.cases) {
                    const outcome = await runPlanted(
                        sandbox.path,
                        { check: shape.check, files: { [shape.planted]: text }, expected: rule },
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

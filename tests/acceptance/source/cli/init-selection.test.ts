// A recommended configuration joins the selection only when the repository holds what it detects (K-182).
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';

const INIT = ['init', '--yes', '--dry-run', '--json', '--without', 'naming', 'spelling'];
const QUIET = ['--no-runner', '--no-ci', '--no-hooks', '--no-rules', '--no-install'];
const COMPONENT = '<script setup>\nconst name = 1;\n</script>\n<template><p>{{ name }}</p></template>\n';

async function selected(root: string): Promise<string[]> {
    const result = await run(root, [...INIT, ...QUIET]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout) as { plan: { configurations: { configuration: string }[] } };
    return plan.plan.configurations.map((entry) => entry.configuration);
}

test(
    'init selects a recommended language only when the repository holds its files',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': '{"name":"planted","private":true,"type":"module","dependencies":{"vue":"3.5.22"}}\n',
            'src/Greeting.vue': COMPONENT,
        });
        commitAll(sandbox.path);
        const plain = await selected(sandbox.path);
        expect(plain).toContain('vue');
        expect(plain).toContain('javascript');
        expect(plain).toContain('formatting');
        expect(plain).not.toContain('typescript');
        expect(plain).not.toContain('css');
        await createFileTree(sandbox.path, {
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
            'src/styles.css': 'p {\n    color: #abc;\n}\n',
        });
        commitAll(sandbox.path);
        const typed = await selected(sandbox.path);
        expect(typed).toContain('typescript');
        expect(typed).toContain('css');
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).exists()).toBe(false);
    },
    PLANTED_TIMEOUT_MS,
);

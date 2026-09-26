// A recommended configuration joins the selection only when the repository holds what it detects (K-182).
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { parse } from 'smol-toml';
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

test(
    'init proposes a scope for every folder that holds a project file, with no --scope flag',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': '{"name":"app","private":true,"type":"module"}\n',
            'supabase/config.toml': 'project_id = "planted"\n',
            'api/package.json': '{"name":"api","private":true,"type":"module","dependencies":{"express":"5.1.0"}}\n',
            'api/src/server.js': 'export const port = 3000;\n',
            'ios/Package.swift':
                '// swift-tools-version:6.0\nimport PackageDescription\nlet package = Package(name: "App")\n',
            'ios/Sources/App/App.swift': 'let answer = 42\n',
            'tools/lint/package.json': '{"name":"lint","private":true,"devDependencies":{"eslint":"9.39.5"}}\n',
        });
        commitAll(sandbox.path);
        const result = await run(sandbox.path, [...INIT, ...QUIET]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const output = JSON.parse(result.stdout) as { policy: string; plan: { noLongerRuns: { path: string }[] } };
        const proposed = parse(output.policy) as { scope?: { path: string; configurations: string[] }[] };
        expect(proposed.scope?.map((scope) => scope.path)).toStrictEqual(['api', 'ios']);
        expect(proposed.scope?.find((scope) => scope.path === 'ios')?.configurations).toContain('swift');
        expect(output.plan.noLongerRuns.map((entry) => entry.path)).toStrictEqual(['tools/lint/package.json']);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init fills a setting from the dependency or folder its manifest names',
    async () => {
        await using sandbox = await testdir();
        const nest = { '@nestjs/core': '11.1.6', '@nestjs/common': '11.1.6' };
        const files = {
            'nest-cli.json': '{"collection":"@nestjs/schematics","sourceRoot":"src"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
            'src/main.ts': 'export const port = 3000;\n',
        };
        const settings = async (dependencies: Record<string, string>, extra: Record<string, string>) => {
            await createFileTree(sandbox.path, {
                ...files,
                ...extra,
                'package.json': JSON.stringify({ name: 'api', private: true, type: 'module', dependencies }),
            });
            commitAll(sandbox.path);
            const result = await run(sandbox.path, [...INIT, ...QUIET]);
            expect(result.code, result.stdout + result.stderr).toBe(0);
            const output = JSON.parse(result.stdout) as { policy: string };
            return parse(output.policy) as {
                tools?: { nestjs?: { swagger?: boolean } };
                architecture?: { types_directory?: string };
            };
        };
        const plain = await settings(nest, {});
        expect(plain.tools?.nestjs?.swagger).toBeUndefined();
        expect(plain.architecture?.types_directory).toBeUndefined();
        const documented = await settings(
            { ...nest, '@nestjs/swagger': '11.2.0' },
            { 'src/types/user.ts': 'export type User = { id: string };\n' },
        );
        expect(documented.tools?.nestjs?.swagger).toBe(true);
        expect(documented.architecture?.types_directory).toBe('src/types');
    },
    PLANTED_TIMEOUT_MS,
);

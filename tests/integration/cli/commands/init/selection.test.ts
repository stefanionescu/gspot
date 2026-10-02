// What init selects: a recommended kit only when the repository holds what it detects, and the proposed scopes.
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { QUIET_INIT } from '#tests/config/cli.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { parsePolicyText } from '#cli/policy/read.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { treeContents } from '#tests/harness/planted/preservation.ts';

const SELECTION_INIT = ['init', '--yes', '--dry-run', '--json'];

const COMPONENT = '<script setup>\nconst name = 1;\n</script>\n<template><p>{{ name }}</p></template>\n';

async function selected(root: string): Promise<string[]> {
    const result = await runGspot(root, [...SELECTION_INIT, ...QUIET_INIT]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout) as { plan: { kits: { kit: string }[] } };
    return plan.plan.kits.map((entry) => entry.kit);
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
        expect(plain).toContain('format');
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
        const result = await runGspot(sandbox.path, [...SELECTION_INIT, ...QUIET_INIT]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const output = JSON.parse(result.stdout) as { policy: string; plan: { noLongerRuns: { path: string }[] } };
        const proposed = parse(output.policy) as { scope?: { path: string; kits: string[] }[] };
        expect(proposed.scope?.map((scope) => scope.path)).toStrictEqual(['api', 'ios']);
        expect(proposed.scope?.find((scope) => scope.path === 'ios')?.kits).toContain('swift');
        expect(output.plan.noLongerRuns.map((entry) => entry.path)).toStrictEqual(['tools/lint/package.json']);
    },
    PLANTED_TIMEOUT_MS,
);

test.each([
    { dependency: false, named: false, isSelected: false },
    { dependency: true, named: false, isSelected: true },
    { dependency: false, named: true, isSelected: true },
])(
    'Next.js selects locale checking according to dependencies and explicit choices: %j',
    async ({ dependency, named, isSelected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': JSON.stringify({
                name: 'translated-app',
                private: true,
                dependencies: { next: '16.3.5', ...(dependency ? { 'next-intl': '4.3.9' } : {}) },
            }),
            'app/page.tsx': 'export default function Page() { return "home"; }\n',
        });
        const kits = ['--kits', 'nextjs', ...(named ? ['i18n'] : [])];
        const result = await runGspot(sandbox.path, [...SELECTION_INIT, ...kits, ...QUIET_INIT]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan } = JSON.parse(result.stdout) as { plan: { kits: { kit: string }[] } };
        expect(plan.kits.some(({ kit }) => kit === 'i18n')).toBe(isSelected);
    },
);

test('init proposes workspace scopes without a lockfile and preserves files after resolver failure', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/api/package.json': '{"name":"api"}',
        'packages/api/source.js': 'export const port = 8080;\n',
    });
    const command = ['init', '--yes', '--no-hooks', '--no-ci', '--no-runner', '--no-rules', '--no-install'];
    const proposed = await runGspot(sandbox.path, [...command, '--dry-run', '--json']);
    expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
    const plan = JSON.parse(proposed.stdout) as { policy: string };
    const policy = parsePolicyText(plan.policy, 'gspot.toml');
    expect(policy.scopes.map((scope) => scope.path)).toStrictEqual(['packages/api']);
    writeFileSync(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    const before = treeContents(sandbox.path);
    const refused = await runGspot(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(treeContents(sandbox.path)).toStrictEqual(before);
    writeFileSync(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: ["packages/*"]\n');
    const corrected = await runGspot(sandbox.path, [...command, '--dry-run', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        parsePolicyText((JSON.parse(corrected.stdout) as InitJson).policy!, 'gspot.toml').scopes.map(
            (scope) => scope.path,
        ),
    ).toStrictEqual(['packages/api']);
});

// What init selects: a recommended configuration only when the repository holds what it detects, and the proposed scopes.
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { readTree } from '#tests/harness/preservation.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { parseToolProject } from '#cli/parsers/packages.ts';
import type { RawPolicy } from '#cli/types/policy/settings.ts';
import { COMPONENT, SELECTION_INIT } from '#tests/config/cli/commands/init/selection.ts';

test('accepting defaults leaves the detected initialization plan unchanged', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'source.js': 'export const port = 8080;\n',
    });
    commitAll(sandbox.path);
    const before = readTree(sandbox.path);
    const argv = ['init', '--dry-run', ...QUIET_INIT];
    const selected = await runGspot(sandbox.path, argv);
    const accepted = await runGspot(sandbox.path, [...argv, '--yes']);
    for (const result of [selected, accepted]) {
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('\nconfigurations\n');
        expect(result.stdout).toMatch(/^ {2}licenses\s+detected\s/mu);
    }
    expect(selected.stdout.slice(selected.stdout.indexOf('\nconfigurations\n'))).toBe(
        accepted.stdout.slice(accepted.stdout.indexOf('\nconfigurations\n')),
    );
    expect(readTree(sandbox.path)).toStrictEqual(before);
});

test('initialization identifies a scope flag without attributing it to an absent policy', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'jobs/run.sh': 'echo example\n' });
    commitAll(sandbox.path);
    const before = readTree(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'init',
        '--yes',
        '--dry-run',
        '--scope-configurations',
        'jobs=bash',
        ...QUIET_INIT,
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toMatch(/^scopes\s+jobs\s+from --scope-configurations$/mu);
    expect(result.stdout).not.toContain('from gspot.toml');
    expect(readTree(sandbox.path)).toStrictEqual(before);
});

async function selected(root: string): Promise<string[]> {
    const result = await runGspot(root, [...SELECTION_INIT, ...QUIET_INIT]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    return plan.plan.configurations.map((entry) => entry.configuration);
}

test('init selects a recommended language only when the repository holds its files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"vue":"3.5.22"}}\n',
        'src/Greeting.vue': COMPONENT,
    });
    commitAll(sandbox.path);
    const plain = await selected(sandbox.path);
    expect(plain).toContain('vue');
    expect(plain).toContain('javascript');
    expect(plain).toContain('format');
    expect(plain).not.toContain('typescript');
    expect(plain).toContain('css');
    await createFileTree(sandbox.path, {
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
        'src/styles.css': 'p {\n    color: #abc;\n}\n',
    });
    commitAll(sandbox.path);
    const typed = await selected(sandbox.path);
    expect(typed).toContain('typescript');
    expect(typed).toContain('css');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).exists()).toBe(false);
});

test('init proposes a scope for every folder that holds a project file, with no --scope-configurations flag', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"app","private":true,"type":"module"}\n',
        'supabase/config.toml': 'project_id = "example"\n',
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
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'policy' | 'plan'>>;
    const proposed = parse(output.policy) as RawPolicy;
    expect(proposed.scope?.map((scope) => scope.path)).toStrictEqual(['api', 'ios']);
    expect(proposed.scope?.find((scope) => scope.path === 'ios')?.configurations).toContain('swift');
    expect(output.plan.noLongerRuns.map((entry) => entry.path)).toStrictEqual(['tools/lint/package.json']);
});

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
        const configurations = ['--configurations', 'nextjs', ...(named ? ['i18n'] : [])];
        const result = await runGspot(sandbox.path, [...SELECTION_INIT, ...configurations, ...QUIET_INIT]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
        expect(plan.configurations.some(({ configuration }) => configuration === 'i18n')).toBe(isSelected);
    },
);

test('init proposes workspace scopes without a lockfile and preserves files after resolver failure', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/api/package.json': '{"name":"api"}',
        'packages/api/source.js': 'export const port = 8080;\n',
    });
    const command = ['init', '--yes', ...QUIET_INIT];
    const proposed = await runGspot(sandbox.path, [...command, '--dry-run', '--json']);
    expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
    const plan = JSON.parse(proposed.stdout) as Required<Pick<InitJson, 'policy'>>;
    const policy = parseStrictPolicy(plan.policy);
    expect(policy.scopes.map((scope) => scope.path)).toStrictEqual(['packages/api']);
    writeFileSync(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    const before = readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(readTree(sandbox.path)).toStrictEqual(before);
    writeFileSync(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: ["packages/*"]\n');
    const corrected = await runGspot(sandbox.path, [...command, '--dry-run', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        parseStrictPolicy((JSON.parse(corrected.stdout) as InitJson).policy!).scopes.map((scope) => scope.path),
    ).toStrictEqual(['packages/api']);
});

test('init previews only applicable private projects and duplicate pins for the selected runner', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'source.py': 'print("hello")\n',
        'mise.toml': '[tools]\nruff = "0.9.0"\nvale = "3.0.0"\n',
    });
    const result = await runGspot(sandbox.path, [...SELECTION_INIT, '--configurations', 'python', ...QUIET_INIT]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    expect(plan.change).toContainEqual({
        path: '.gspot/pyproject.toml',
        note: '6 pinned Python tools; matching uv.lock and private environment',
    });
    expect(plan.change).toContainEqual({ path: '.gspot/package.json', note: '1 pinned npm tools; matching lockfile' });
    expect(plan.noLongerRuns).toStrictEqual([
        { path: 'mise.toml', note: '1 pin gspot also pins (gspot doctor lists them)' },
    ]);
    const written = await runGspot(sandbox.path, [
        'init',
        '--yes',
        '--json',
        '--configurations',
        'python',
        ...QUIET_INIT,
    ]);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const installed = parseToolProject(await Bun.file(join(sandbox.path, '.gspot/package.json')).text());
    expect(Object.keys(installed.dependencies)).toStrictEqual(['editorconfig-checker']);
});

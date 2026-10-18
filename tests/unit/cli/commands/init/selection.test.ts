import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { parse } from '@decimalturn/toml-patch';
import { commitAll } from '#tests/setup/git.ts';
import { readTree } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { type InitJson } from '#cli/types/commands/init.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { parseToolProject } from '#cli/tools/npm/tool-project.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';
import { VUE_COMPONENT } from '#tests/data/checks/component-samples.ts';
import { buildInitArguments, listAlwaysSelected } from '#tests/setup/builders.ts';
import { TOOL_ONLY_PACKAGE, CONFIGURATION_CHOICES, NON_JAVASCRIPT_PROJECTS } from '#tests/data/commands/init.ts';

test.each([...CONFIGURATION_CHOICES])(
    'init with --configurations %j keeps the always-selected configurations',
    async ({ configurations }) => {
        await using sandbox = await testdir({
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            'source.js': 'export const port = 8080;\n',
        });
        commitAll(sandbox.path);
        const initialized = await runGspot(sandbox.path, [
            'init',
            '--yes',
            ...(configurations === undefined || configurations.length === 0
                ? []
                : ['--configurations', ...configurations]),
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        const selected = session.scopes[0]!.selected.map((manifest) => manifest.configuration.name);
        for (const configuration of listAlwaysSelected()) expect(selected).toContain(configuration);
    },
);

// The init plan picks languages from the sources and keeps package boundaries.
test.each([...NON_JAVASCRIPT_PROJECTS])(
    'a root package.json with only tool dependencies leaves JavaScript to the scope with Node source (%s)',
    async (language, file, source) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': TOOL_ONLY_PACKAGE,
            'app/package.json': '{"name":"example-app","private":true}\n',
            [`app/${file}`]: source,
        });
        const before = await readTree(sandbox.path);
        const commandArguments = [...buildInitArguments([]).filter((argument) => argument !== '--yes'), '--dry-run'];
        const preview = await runGspot(sandbox.path, commandArguments);
        const accepted = await runGspot(sandbox.path, [...commandArguments, '--yes']);
        for (const result of [preview, accepted]) {
            expect(result.code, `${language}: ${result.stdout}${result.stderr}`).toBe(0);
            expect(result.stdout).toContain('\nconfigurations\n');
            expect(result.stdout).toMatch(/^ {2}javascript\s/mu);
        }
        expect(preview.stdout.slice(preview.stdout.indexOf('\nconfigurations\n'))).toBe(
            accepted.stdout.slice(accepted.stdout.indexOf('\nconfigurations\n')),
        );
        const json = await runGspot(sandbox.path, [...commandArguments, '--yes', '--json']);
        expect(json.code, json.stdout + json.stderr).toBe(0);
        const output = JSON.parse(json.stdout) as Required<Pick<InitJson, 'plan' | 'settings'>>;
        expect(output.plan.configurations.map(({ configuration }) => configuration)).toContain('javascript');
        expect(
            Object.keys(parseSettings(output.settings, sandbox.path, createReadCache(process.cwd())).scopes),
        ).toStrictEqual(['app']);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const written = await runGspot(sandbox.path, buildInitArguments([], { json: true }));
        expect(written.code, written.stdout + written.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        expect(session.repository.scopes.map(({ path }) => path)).toStrictEqual(['', 'app']);
        expect(session.scopes.find(({ scope }) => scope.path === '')!.view.configurations).not.toContain('javascript');
        expect(session.scopes.find(({ scope }) => scope.path === 'app')!.view.configurations).toContain('javascript');
    },
);

test.each([...NON_JAVASCRIPT_PROJECTS])(
    'JavaScript tools arrive after JavaScript is selected for new Node source, at both levels (%s)',
    async (language, file, source) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': TOOL_ONLY_PACKAGE, [file]: source });
        const initialized = await runGspot(sandbox.path, buildInitArguments([], { json: true }));
        expect(initialized.code, `${language}: ${initialized.stdout}${initialized.stderr}`).toBe(0);
        for (const level of LEVELS) {
            const selected = await runGspot(sandbox.path, ['set', 'level', level]);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const session = await openSession(sandbox.path);
            const project = parseToolProject(
                await Bun.file(join(sandbox.path, '.gspot/package.json')).text(),
                session.requirePackageManager().name,
            );
            for (const name of ['eslint', 'knip', 'typescript', '@gspothq/eslint-plugin'])
                expect(Object.keys(project.dependencies)).not.toContain(name);
            expect(await Bun.file(join(sandbox.path, '.gspot/config/eslint.config.mjs')).exists()).toBe(false);
        }
        await Bun.write(join(sandbox.path, 'run'), '#!/usr/bin/env node\nconsole.log(1);\n');
        const discovered = await runGspot(sandbox.path, ['add', 'javascript']);
        expect(discovered.code, discovered.stdout + discovered.stderr).toBe(0);
        for (const level of LEVELS) {
            const applied = await runGspot(sandbox.path, ['set', 'level', level]);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const selected = await openSession(sandbox.path);
            expect(selected.scopes.flatMap(({ view }) => view.configurations)).toContain('javascript');
            const project = parseToolProject(
                await Bun.file(join(sandbox.path, '.gspot/package.json')).text(),
                selected.requirePackageManager().name,
            );
            expect(Object.keys(project.dependencies)).toContain('eslint');
            expect(await Bun.file(join(sandbox.path, '.gspot/config/eslint.config.mjs')).exists()).toBe(true);
        }
    },
);

test('accepting the defaults leaves the detected plan unchanged', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'source.js': 'export const port = 8080;\n',
        'api/pyproject.toml': `[project]
name = "api"
version = "1.0.0"
`,
        'api/source.py': 'PORT = 8080\n',
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const commandArguments = [...buildInitArguments([]).filter((argument) => argument !== '--yes'), '--dry-run'];
    const selected = await runGspot(sandbox.path, commandArguments);
    const accepted = await runGspot(sandbox.path, [...commandArguments, '--yes']);
    for (const result of [selected, accepted]) {
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('\nconfigurations\n');
        expect(result.stdout).toMatch(/^ {2}licenses\s+detected\s/mu);
        expect(result.stdout).toMatch(/^ {2}security\s+detected\s/mu);
        expect(result.stdout).toMatch(/^ {2}duplication\s+detected\s/mu);
    }
    expect(selected.stdout.slice(selected.stdout.indexOf('\nconfigurations\n'))).toBe(
        accepted.stdout.slice(accepted.stdout.indexOf('\nconfigurations\n')),
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

async function listPlannedConfigurations(root: string): Promise<string[]> {
    const result = await runGspot(root, [...buildInitArguments([], { json: true }), '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    return plan.plan.configurations.map((entry) => entry.configuration);
}

test('init selects a recommended language only when the repository holds its files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"vue":"3.5.22"}}\n',
        'src/Greeting.vue': VUE_COMPONENT,
    });
    commitAll(sandbox.path);
    const plain = await listPlannedConfigurations(sandbox.path);
    expect(plain).toContain('vue');
    expect(plain).toContain('javascript');
    expect(plain).toContain('format');
    expect(plain).not.toContain('typescript');
    expect(plain).toContain('css');
    await createFileTree(sandbox.path, {
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
        'src/styles.css': `p {
    color: #abc;
}
`,
    });
    commitAll(sandbox.path);
    const typed = await listPlannedConfigurations(sandbox.path);
    expect(typed).toContain('typescript');
    expect(typed).toContain('css');
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).exists()).toBe(false);
});

test('init proposes a project scope and sets lint-only packages aside', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"app","private":true,"type":"module"}\n',
        'supabase/config.toml': 'project_id = "example"\n',
        'ios/Package.swift': `// swift-tools-version:6.0
import PackageDescription
let package = Package(name: "App")
`,
        'ios/Sources/App/App.swift': 'let answer = 42\n',
        'tools/lint/package.json': '{"name":"lint","private":true,"devDependencies":{"eslint":"9.39.5"}}\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, [...buildInitArguments([], { json: true }), '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings' | 'plan'>>;
    const proposed = settingsSchema.parse(parse(output.settings) as TomlTable);
    expect(proposed.scope!.map(({ path }) => path)).toStrictEqual(['ios']);
    expect(proposed.scope!.find(({ path }) => path === 'ios')?.configurations).toContain('swift');
    expect(output.plan.noLongerRuns).toStrictEqual([]);
    expect(output.plan.change).toContainEqual({
        path: 'tools/lint/package.json',
        note: 'eslint is now pinned in .gspot/package.json; remove it from devDependencies if nothing else uses it',
    });
});

test.each([
    { dependency: false, named: false, isSelected: false },
    { dependency: true, named: false, isSelected: false },
    { dependency: false, named: true, isSelected: true },
])(
    'a named Next.js configuration list wins over locale dependency detection: %j',
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
        const configurations = ['--configurations', 'nextjs', ...(named ? ['translations'] : [])];
        const result = await runGspot(sandbox.path, [
            ...buildInitArguments([], { json: true }),
            '--dry-run',
            ...configurations,
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
        expect(plan.configurations.some(({ configuration }) => configuration === 'translations')).toBe(isSelected);
    },
);

test('init proposes workspace scopes without a lockfile, and writes nothing when the workspace file is broken', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true,"packageManager":"pnpm@9.0.0","workspaces":["packages/*"]}',
        'packages/api/package.json': '{"name":"api"}',
        'packages/api/source.js': 'export const port = 8080;\n',
    });
    const command = buildInitArguments([]);
    const proposed = await runGspot(sandbox.path, [...command, '--dry-run', '--json']);
    expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
    const plan = JSON.parse(proposed.stdout) as Required<Pick<InitJson, 'settings'>>;
    const settings = parseSettings(plan.settings, undefined, createReadCache(process.cwd()));
    expect(Object.keys(settings.scopes)).toStrictEqual(['packages/api']);
    await writeFile(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('end with a ]');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('a named configuration brings its suggested configurations', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'tools/a.sh': CLEAN_BASH_SCRIPT, 'jobs/b.sh': CLEAN_BASH_SCRIPT });
    commitAll(sandbox.path);
    const preview = [...buildInitArguments([], { json: true }), '--dry-run'];
    const named = await runGspot(sandbox.path, [...preview, '--configurations', 'bash']);
    expect(named.code, named.stdout + named.stderr).toBe(0);
    const { plan } = JSON.parse(named.stdout) as Required<Pick<InitJson, 'plan'>>;
    const configurations = plan.configurations.map(({ configuration }) => configuration);
    for (const configuration of ['bash', 'format', 'naming']) expect(configurations).toContain(configuration);
});

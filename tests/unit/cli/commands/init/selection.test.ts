import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { parse } from '@decimalturn/toml-patch';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { type InitJson } from '#cli/types/commands/init.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { type ToolPackageJson } from '#cli/types/install/npm.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { settingsSchema } from '#cli/schemas/settings/gspot-toml.ts';
import { listAlwaysSelected } from '#tests/setup/cli/configurations.ts';
import { runGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';

import {
    VUE_COMPONENT,
    PYTHON_SOURCE,
    TOOL_ONLY_PACKAGE,
    STYLE_SOURCE_FILES,
    NEXTJS_LOCALE_CASES,
    MIXED_LANGUAGE_FILES,
    CONFIGURATION_CHOICES,
    PLATFORM_PROJECT_FILES,
} from '#tests/data/commands/init/selection.ts';

async function listPlannedConfigurations(root: string): Promise<string[]> {
    const result = await runGspot(root, [...buildInitArguments([], { json: true }), '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    return plan.plan.configurations.map((entry) => entry.configuration);
}

test.each([...CONFIGURATION_CHOICES])(
    'init with --configurations %j keeps the always-selected configurations',
    async (entry) => {
        const { configurations } = entry;
        const flags = configurations === undefined ? [] : ['--configurations', ...configurations];
        if ('noConfigurations' in entry) flags.push('--no-configurations');
        await using sandbox = await testdir({
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            'source.js': 'export const port = 8080;\n',
        });
        commitAll(sandbox.path);
        const initialized = await runGspot(sandbox.path, ['init', '--yes', ...flags]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        const selected = session.scopes[0]!.configurations.map((configuration) => configuration.name);
        for (const configuration of listAlwaysSelected()) expect(selected).toContain(configuration);
    },
);

test('init leaves javascript out of a root package.json with only tool dependencies and selects it in the app package scope', async () => {
    await using sandbox = await testdir({
        'package.json': TOOL_ONLY_PACKAGE,
        'app/package.json': '{"name":"example-app","private":true}\n',
        'app/server.js': 'export const port = 8080;\n',
    });

    const before = await readTree(sandbox.path);
    const commandArguments = [...buildInitArguments([]).filter((argument) => argument !== '--yes'), '--dry-run'];
    const preview = await runGspot(sandbox.path, commandArguments);
    const accepted = await runGspot(sandbox.path, [...commandArguments, '--yes']);
    for (const result of [preview, accepted]) {
        expect(result.code, result.stdout + result.stderr).toBe(0);
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
    expect(Object.keys(parseSettings(output.settings, sandbox.path).scopes)).toStrictEqual(['app']);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const written = await runGspot(sandbox.path, buildInitArguments([], { json: true }));
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    expect(session.repository.scopeFolders.map(({ path }) => path)).toStrictEqual(['', 'app']);
    expect(session.scopes.find(({ folder }) => folder.path === '')!.settings.configurations).not.toContain(
        'javascript',
    );
    expect(session.scopes.find(({ folder }) => folder.path === 'app')!.settings.configurations).toContain('javascript');
});

test('the JavaScript tools and the ESLint config file appear only after gspot add javascript for a new Node script, at both levels', async () => {
    await using sandbox = await testdir({ 'package.json': TOOL_ONLY_PACKAGE, ...PYTHON_SOURCE });

    const initialized = await runGspot(sandbox.path, buildInitArguments([], { json: true }));
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    for (const level of LEVELS) {
        const selected = await runGspot(sandbox.path, ['set', 'level', level]);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const dependencies = Object.keys(
            (JSON.parse(await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8')) as ToolPackageJson)
                .devDependencies,
        );
        for (const name of ['eslint', 'knip', 'typescript', '@gspothq/eslint-plugin'])
            expect(dependencies).not.toContain(name);
        expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/language/javascript/eslint.mjs'))).toBe(false);
    }
    await writeFile(join(sandbox.path, 'run'), '#!/usr/bin/env node\nconsole.log(1);\n');
    const discovered = await runGspot(sandbox.path, ['add', 'javascript']);
    expect(discovered.code, discovered.stdout + discovered.stderr).toBe(0);
    for (const level of LEVELS) {
        const applied = await runGspot(sandbox.path, ['set', 'level', level]);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const selected = await openSession(sandbox.path);
        expect(selected.scopes.flatMap(({ settings }) => settings.configurations)).toContain('javascript');
        const dependencies = Object.keys(
            (JSON.parse(await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8')) as ToolPackageJson)
                .devDependencies,
        );
        expect(dependencies).toContain('eslint');
        expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/language/javascript/eslint.mjs'))).toBe(true);
    }
});

test('accepting the defaults leaves the detected plan unchanged', async () => {
    await using sandbox = await testdir(MIXED_LANGUAGE_FILES);

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

test('init selects a recommended language only when the repository holds its files', async () => {
    await using sandbox = await testdir({
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
    await createFileTree(sandbox.path, STYLE_SOURCE_FILES);
    commitAll(sandbox.path);
    const typed = await listPlannedConfigurations(sandbox.path);
    expect(typed).toContain('typescript');
    expect(typed).toContain('css');
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
});

test('init proposes a scope for a Swift package, not for a lint-only package, and says that its eslint pin moved to .gspot/package.json', async () => {
    await using sandbox = await testdir(PLATFORM_PROJECT_FILES);

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
        note: 'eslint is now pinned in .gspot/package.json; remove it from package.json if nothing else uses it',
    });
});

test.each([...NEXTJS_LOCALE_CASES])(
    'a named Next.js configuration list wins over locale dependency detection: %j',
    async ({ dependency, named, isSelected }) => {
        await using sandbox = await testdir({
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
    await using sandbox = await testdir({
        'package.json': '{"private":true,"packageManager":"pnpm@9.0.0","workspaces":["packages/*"]}',
        'packages/api/package.json': '{"name":"api"}',
        'packages/api/source.js': 'export const port = 8080;\n',
    });

    const command = buildInitArguments([]);
    const proposed = await runGspot(sandbox.path, [...command, '--dry-run', '--json']);
    expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
    const plan = JSON.parse(proposed.stdout) as Required<Pick<InitJson, 'settings'>>;
    const settings = parseSettings(plan.settings, undefined);
    expect(Object.keys(settings.scopes)).toStrictEqual(['packages/api']);
    await writeFile(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, command);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    const message =
        'pnpm-workspace.yaml is not a valid workspace file: Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 12:\n\npackages: [\n           ^\n. Fix the file.';
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toBe(`${message}\n`);
    const structured = await runGspot(sandbox.path, [...command, '--json']);
    expect(structured.code).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({ error: 'filesystem', message });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

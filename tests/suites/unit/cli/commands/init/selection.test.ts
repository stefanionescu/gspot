import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { parse } from '@decimalturn/toml-patch';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { type InitJson } from '#cli/types/commands/init.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { isOnDisk, readTree } from '#tests/setup/system/files.ts';
import { type ToolPackageJson } from '#cli/types/installers/npm.ts';
import { listAlwaysSelected } from '#tests/setup/cli/configurations.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { commitAll, createGitSandbox } from '#tests/setup/system/git.ts';
import { runGspot, buildInitArguments, expectRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';

import {
    TOOL_ONLY_PACKAGE,
    STYLE_SOURCE_FILES,
    NEXTJS_LOCALE_CASES,
    CONFIGURATION_CHOICES,
    PLATFORM_PROJECT_FILES,
} from '#tests/config/commands/init/selection.ts';

async function listPlannedConfigurations(root: string): Promise<string[]> {
    const result = await runGspot(root, [...buildInitArguments([]), '--json', '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    return plan.plan.configurations.map((each) => each.configuration);
}

test.each([...CONFIGURATION_CHOICES])(
    'init with --configurations %j keeps the always-selected configurations',
    async (row) => {
        const { configurations } = row;
        const flags = configurations === undefined ? [] : ['--configurations', ...configurations];
        if ('noConfigurations' in row) flags.push('--no-configurations');
        await using sandbox = await createGitSandbox({
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            'source.js': 'export const port = 8080;\n',
        });
        commitAll(sandbox.path);
        const initialized = await runGspot(sandbox.path, ['init', '--yes', ...flags]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        const selected = session.scopes[0]!.configurations.map((configuration) => configuration.name);
        expect(selected).toStrictEqual([...row.expected]);
    },
);

test('init leaves javascript out of a root package.json with only tool dependencies and selects it in the app package scope', async () => {
    await using sandbox = await createGitSandbox({
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
    }
    expect(preview.stdout.slice(preview.stdout.indexOf('\nconfigurations\n'))).toBe(
        accepted.stdout.slice(accepted.stdout.indexOf('\nconfigurations\n')),
    );
    const json = await runGspot(sandbox.path, [...commandArguments, '--yes', '--json']);
    expect(json.code, json.stdout + json.stderr).toBe(0);
    const output = JSON.parse(json.stdout) as Required<Pick<InitJson, 'plan' | 'settings'>>;
    expect(
        output.plan.configurations
            .map(({ configuration }) => configuration)
            .filter((configuration) => !listAlwaysSelected().includes(configuration)),
    ).toStrictEqual(['licenses', 'javascript']);
    expect(Object.keys(parseSettings(output.settings, sandbox.path).scopes)).toStrictEqual(['app']);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const written = await runGspot(sandbox.path, [...buildInitArguments([]), '--json']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    expect(session.repository.scopeFolders.map(({ path }) => path)).toStrictEqual(['', 'app']);
    expect(
        session.scopes.map(({ folder, settings }) => [
            folder.path,
            settings.configurations.filter((configuration) => !listAlwaysSelected().includes(configuration)),
        ]),
    ).toStrictEqual([
        ['', ['licenses']],
        ['app', ['licenses', 'javascript']],
    ]);
});

test('the JavaScript tools and the ESLint config file appear only after gspot add javascript for a new Node script, at both levels', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': TOOL_ONLY_PACKAGE,
        'source.py': 'VALUE = 1\n',
    });

    const initialized = await runGspot(sandbox.path, [...buildInitArguments([]), '--json']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    for (const level of LEVELS) {
        const levelSet = await runGspot(sandbox.path, ['set', 'level', level]);
        expect(levelSet.code, levelSet.stdout + levelSet.stderr).toBe(0);
        const contents = (
            JSON.parse(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')) as ToolPackageJson
        ).devDependencies;
        const dependencies = Object.keys(contents);
        expect(
            ['eslint', 'knip', 'typescript', '@gspothq/eslint-plugin'].filter((name) => dependencies.includes(name)),
        ).toStrictEqual([]);
        const exists = await isOnDisk(join(sandbox.path, findManifestTarget('javascript', 'eslint/eslint.mjs')));
        expect(exists).toBe(false);
    }
    await writeFile(join(sandbox.path, 'run'), '#!/usr/bin/env node\nconsole.log(1);\n');
    const discovered = await runGspot(sandbox.path, ['add', 'javascript']);
    expect(discovered.code, discovered.stdout + discovered.stderr).toBe(0);
    for (const level of LEVELS) {
        const applied = await runGspot(sandbox.path, ['set', 'level', level]);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const contents = (
            JSON.parse(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')) as ToolPackageJson
        ).devDependencies;
        const dependencies = Object.keys(contents);
        expect(
            ['eslint', 'knip', 'typescript', '@gspothq/eslint-plugin'].filter((name) => dependencies.includes(name)),
        ).toStrictEqual(['eslint', 'knip', 'typescript', '@gspothq/eslint-plugin']);
        const exists = await isOnDisk(join(sandbox.path, findManifestTarget('javascript', 'eslint/eslint.mjs')));
        expect(exists).toBe(true);
    }
});

test('init selects a recommended language only when the repository holds its files', async () => {
    await using sandbox = await testdir({
        'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"vue":"3.5.22"}}\n',
        'src/Greeting.vue': `<script setup>
const name = 1;
</script>
<template><p>{{ name }}</p></template>
`,
    });

    commitAll(sandbox.path);
    const defaults = await listPlannedConfigurations(sandbox.path);
    expect(defaults.filter((configuration) => !listAlwaysSelected().includes(configuration))).toStrictEqual([
        'css',
        'javascript',
        'licenses',
        'vue',
    ]);
    await createFileTree(sandbox.path, STYLE_SOURCE_FILES);
    commitAll(sandbox.path);
    const typed = await listPlannedConfigurations(sandbox.path);
    expect(typed.filter((configuration) => !listAlwaysSelected().includes(configuration))).toStrictEqual([
        'css',
        'javascript',
        'licenses',
        'typescript',
        'vue',
    ]);
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
});

test('init proposes a scope for a Swift package, not for a lint-only package, and says that its eslint pin moved to .gspot/package.json', async () => {
    await using sandbox = await testdir(PLATFORM_PROJECT_FILES);

    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, [...buildInitArguments([]), '--json', '--dry-run']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settings' | 'plan'>>;
    const proposed = settingsSchema.parse(parse(output.settings) as TomlTable);
    expect(proposed.scope!.map(({ path }) => path)).toStrictEqual(['ios']);
    expect(proposed.scope!.find(({ path }) => path === 'ios')?.configurations).toStrictEqual(['swift']);
    expect(output.plan.noLongerRuns).toStrictEqual([]);
    expect(output.plan.change).toContainEqual({
        path: 'tools/lint/package.json',
        note: 'eslint is now pinned in .gspot/package.json; remove it from package.json if nothing else uses it',
    });
});

test.each([...NEXTJS_LOCALE_CASES])(
    'a named Next.js configuration list wins over locale dependency detection: %j',
    async ({ dependency, named, isSelected }) => {
        await using sandbox = await createGitSandbox({
            'package.json': JSON.stringify({
                name: 'translated-app',
                private: true,
                dependencies: { next: '16.3.5', ...(dependency && { 'next-intl': '4.3.9' }) },
            }),
            'app/page.tsx': 'export default function Page() { return "home"; }\n',
        });

        const configurations = ['--configurations', 'nextjs', ...(named ? ['translations'] : [])];
        const result = await runGspot(sandbox.path, [
            ...buildInitArguments([]),
            '--json',
            '--dry-run',
            ...configurations,
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
        expect(plan.configurations.some(({ configuration }) => configuration === 'translations')).toBe(isSelected);
    },
);

test('init proposes workspace scopes without a lockfile, and writes nothing when the workspace file is broken', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true,"packageManager":"pnpm@9.0.0","workspaces":["packages/*"]}',
        'packages/api/package.json': '{"name":"api"}',
        'packages/api/source.js': 'export const port = 8080;\n',
    });

    const command = buildInitArguments([]);
    const proposed = await runGspot(sandbox.path, [...command, '--dry-run', '--json']);
    expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
    const plan = JSON.parse(proposed.stdout) as Required<Pick<InitJson, 'settings'>>;
    const settings = parseSettings(plan.settings, sandbox.path);
    expect(Object.keys(settings.scopes)).toStrictEqual(['packages/api']);
    await writeFile(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    const message =
        'pnpm-workspace.yaml is not a valid workspace file: Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 12:\n\npackages: [\n           ^\n. Fix the file.';
    await expectRefusalWithoutWrites(sandbox.path, command, { error: 'filesystem', message });
});

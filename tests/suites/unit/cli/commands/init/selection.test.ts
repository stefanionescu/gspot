import { join } from 'node:path';
import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { openSession } from '#cli/engine/session.ts';
import { readSettings } from '#cli/settings/read.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { TomlTable } from '#cli/types/settings.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import type { InitJson } from '#cli/types/commands/edits.ts';
import type { ToolPackageJson } from '#tests/types/setup.ts';
import { LEVELS, GSPOT_PATHS } from '#cli/config/manifests.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { listAlwaysSelected } from '#tests/setup/cli/manifests.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { NODE_SCRIPT, UNCLOSED_PACKAGES } from '#tests/config/setup/languages.ts';

import {
    TOOL_ONLY_PACKAGE,
    STYLE_SOURCE_FILES,
    NEXTJS_LOCALE_CASES,
    CONFIGURATION_CHOICES,
    PLATFORM_PROJECT_FILES,
} from '#tests/config/generation/plan.ts';

async function listPlannedConfigurations(root: string): Promise<string[]> {
    const result = await runGspot(root, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
    return plan.plan.configurations.map((each) => each.configuration);
}

test.each([...CONFIGURATION_CHOICES])(
    'init with --configurations %j keeps the always-selected configurations',
    async (row) => {
        const { configurations } = row;
        const flags =
            configurations === undefined
                ? []
                : configurations.flatMap((configuration) => ['--configurations', configuration]);
        if ('noConfigurations' in row) flags.push('--no-configurations');
        await using sandbox = await createGitSandbox({
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            'source.js': 'export const port = 8080;\n',
        });
        commitAll(sandbox.path);
        const initialized = await runGspot(sandbox.path, ['init', ...flags]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        const { configurations: selected } = session.scopes[0]!;
        expect(selected.filter(({ group }) => group !== 'general').map(({ name }) => name)).toStrictEqual([
            ...row.selected,
        ]);
        expect(selected.map(({ name }) => name)).toContain('structure');
    },
);

test('init combines repeated and comma-separated configuration names', async () => {
    await using sandbox = await createGitSandbox({ 'sample.txt': 'Example.\n' });
    const result = await runGspot(sandbox.path, [
        'init',
        '--configurations',
        'bash, markdown',
        '--configurations',
        'sql',
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const saved = readSettings(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'), sandbox.path);
    for (const name of ['bash', 'markdown', 'sql']) expect(saved.configurations).toContain(name);
});

test('init leaves javascript out of a root package.json with only tool dependencies and selects it in the app package scope', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': TOOL_ONLY_PACKAGE,
        'app/package.json': '{"name":"example-app","private":true}\n',
        'app/server.js': 'export const port = 8080;\n',
    });

    const accepted = await runGspot(sandbox.path, ['init']);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    const session = await openSession(sandbox.path);
    expect(session.repository.scopeFolders.map(({ path }) => path)).toStrictEqual(['', 'app']);
    expect(
        session.scopes.map(({ path, settings }) => [
            path,
            settings.configurations.filter((configuration) => !listAlwaysSelected().includes(configuration)),
        ]),
    ).toStrictEqual([
        ['', []],
        ['app', ['javascript']],
    ]);
});

test('the JavaScript tools and the ESLint config file appear only after gspot add javascript for a new Node script, at both levels', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': TOOL_ONLY_PACKAGE,
        'source.py': 'VALUE = 1\n',
    });

    const initialized = await runGspot(sandbox.path, ['init', '--json']);
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
        const generated = join(sandbox.path, getManifestTarget('javascript', 'eslint/eslint.mjs'));
        expect(existsSync(generated)).toBe(false);
    }
    await writeFile(join(sandbox.path, 'run'), NODE_SCRIPT);
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
        const generated = join(sandbox.path, getManifestTarget('javascript', 'eslint/eslint.mjs'));
        expect(existsSync(generated)).toBe(true);
    }
});

test('init selects a suggested language only when the repository holds its files', async () => {
    const files = {
        'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"vue":"3.5.22"}}\n',
        'src/Greeting.vue': `<script setup>
const name = 1;
</script>
<template><p>{{ name }}</p></template>
`,
    };
    await using sandbox = await testdir(files);
    await using styled = await testdir({ ...files, ...STYLE_SOURCE_FILES });

    commitAll(sandbox.path);
    commitAll(styled.path);
    const defaults = await listPlannedConfigurations(sandbox.path);
    expect(defaults.filter((configuration) => !listAlwaysSelected().includes(configuration))).toStrictEqual([
        'css',
        'javascript',
        'vue',
    ]);
    const typed = await listPlannedConfigurations(styled.path);
    expect(typed.filter((configuration) => !listAlwaysSelected().includes(configuration))).toStrictEqual([
        'css',
        'javascript',
        'typescript',
        'vue',
    ]);
});

test('init proposes a scope for a Swift package, not for a lint-only package, and says that its eslint pin moved to .gspot/package.json', async () => {
    await using sandbox = await testdir(PLATFORM_PROJECT_FILES);

    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Required<Pick<InitJson, 'settingsText' | 'plan'>>;
    const proposed = settingsSchema.parse(parse(output.settingsText) as TomlTable);
    expect(proposed.scope!.map(({ path }) => path)).toStrictEqual(['ios']);
    expect(proposed.scope!.find(({ path }) => path === 'ios')?.configurations).toStrictEqual(['swift']);
    expect(output.plan.lintFolders).toStrictEqual([]);
    expect(output.plan.change.filter(({ path }) => path === 'tools/lint/package.json')).toStrictEqual([]);
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

        const configurations = ['--configurations', 'nextjs', ...(named ? ['--configurations', 'translations'] : [])];
        const result = await runGspot(sandbox.path, ['init', '--json', ...configurations]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const { plan } = JSON.parse(result.stdout) as Required<Pick<InitJson, 'plan'>>;
        expect(plan.configurations.some(({ configuration }) => configuration === 'translations')).toBe(isSelected);
    },
);

test('init proposes workspace scopes without a lockfile, and writes nothing when the workspace file is broken', async () => {
    const files = {
        'package.json': '{"private":true,"packageManager":"pnpm@9.0.0","workspaces":["packages/*"]}',
        'packages/api/package.json': '{"name":"api"}',
        'packages/api/source.js': 'export const port = 8080;\n',
    };
    await using sandbox = await createGitSandbox(files);
    await using broken = await createGitSandbox({ ...files, 'pnpm-workspace.yaml': UNCLOSED_PACKAGES });

    const command = ['init', '--json'];
    const proposed = await runGspot(sandbox.path, command);
    expect(proposed.code, proposed.stdout + proposed.stderr).toBe(0);
    const plan = JSON.parse(proposed.stdout) as Required<Pick<InitJson, 'settingsText'>>;
    const settings = readSettings(plan.settingsText, sandbox.path);
    expect(settings.scopes.keys().toArray()).toStrictEqual(['packages/api']);
    const before = await readTree(broken.path);
    const refused = await runGspot(broken.path, command);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'filesystem' });
    expect((JSON.parse(refused.stdout) as { message: string }).message).toStartWith(
        'pnpm-workspace.yaml is not a valid workspace file: ',
    );
    expect(await readTree(broken.path)).toStrictEqual(before);
});

test('init keeps root Docker and GitHub configurations beside an app scope', async () => {
    await using sandbox = await createGitSandbox({
        Dockerfile: 'FROM scratch\n',
        '.github/workflows/test.yml': 'name: Test\non: push\njobs: {}\n',
        'app/package.json': '{"name":"example-app","private":true}',
        'app/index.js': 'export const port = 8080;\n',
    });
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stderr).toBe(0);
    const { settingsText } = JSON.parse(result.stdout) as InitJson;
    const parsed = readSettings(settingsText, sandbox.path);
    expect(parsed.configurations).toContain('docker');
    expect(parsed.configurations).toContain('github-actions');
    expect(parsed.scopes.keys().toArray()).toContain('app');
});

test('init names an uninstalled tsconfig extension and the dependency install step', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"example-app","private":true}',
        'tsconfig.json': '{"extends":"@tsconfig/node22/tsconfig.json"}',
        'index.ts': 'export const port = 8080;\n',
    });
    const result = await runGspot(sandbox.path, ['init']);
    expect(result.code).toBe(2);
    expect(result.stderr).toBe(
        'tsconfig.json extends @tsconfig/node22/tsconfig.json, which is not installed. Install the project dependencies, then run the command again.\n',
    );
});

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { initOutputSchema } from '#cli/schemas/commands.ts';
import { readSettings } from '#cli/settings/read.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { CONFIGURATION_CHOICES, NEXTJS_LOCALE_CASES, TOOL_ONLY_PACKAGE } from '#tests/config/generation/plan.ts';
import { NODE_SCRIPT, UNCLOSED_PACKAGES } from '#tests/config/setup/languages.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { listAlwaysSelected } from '#tests/setup/cli/manifests.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import type { ToolPackageJson } from '#tests/types/setup.ts';

test.each([...CONFIGURATION_CHOICES])(
    'init with --configurations %j keeps the always-selected configurations',
    async (row) => {
        using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
        const { configurations } = row;
        const flags =
            configurations === undefined
                ? []
                : configurations.flatMap((configuration) => ['--configurations', configuration]);
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
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
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
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
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

test('the JavaScript tools and the ESLint config file appear only after gspot add javascript for a new Node script', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'package.json': TOOL_ONLY_PACKAGE,
        'source.py': 'VALUE = 1\n',
    });
    const tools = ['eslint', 'knip', 'typescript', '@gspothq/eslint-plugin'];
    const generated = join(sandbox.path, getManifestTarget('javascript', 'eslint/eslint.mjs'));
    const listSelectedTools = async (): Promise<string[]> => {
        const { devDependencies } = JSON.parse(
            await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8'),
        ) as ToolPackageJson;
        return tools.filter((name) => Object.hasOwn(devDependencies, name));
    };

    const initialized = await runGspot(sandbox.path, ['init', '--json']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await listSelectedTools()).toStrictEqual([]);
    expect(existsSync(generated)).toBe(false);
    await writeFile(join(sandbox.path, 'run'), NODE_SCRIPT);
    const discovered = await runGspot(sandbox.path, ['add', 'javascript']);
    expect(discovered.code, discovered.stdout + discovered.stderr).toBe(0);
    expect(await listSelectedTools()).toStrictEqual(tools);
    expect(existsSync(generated)).toBe(true);
});

test.each([...NEXTJS_LOCALE_CASES])(
    'a named Next.js configuration list wins over locale dependency detection: %j',
    async ({ dependency, named, isSelected }) => {
        using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
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
        const { plan } = initOutputSchema.parse(JSON.parse(result.stdout));
        expect(plan.configurations.some(({ configuration }) => configuration === 'translations')).toBe(isSelected);
    },
);

test('init proposes workspace scopes without a lockfile, and writes nothing when the workspace file is broken', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
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
    const plan = initOutputSchema.parse(JSON.parse(proposed.stdout));
    const settings = readSettings(plan.settingsText, sandbox.path);
    expect(settings.scopes.keys().toArray()).toStrictEqual(['packages/api']);
    const before = await readTree(broken.path);
    const refused = await runGspot(broken.path, command);
    expect(refused.code).toBe(2);
    expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'filesystem' });
    expect((JSON.parse(refused.stdout) as { message: string }).message).toContain('pnpm-workspace.yaml');
    expect(await readTree(broken.path)).toStrictEqual(before);
});

test('init keeps root Docker and GitHub configurations beside an app scope', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        Dockerfile: 'FROM scratch\n',
        '.github/workflows/test.yml': 'name: Test\non: push\njobs: {}\n',
        'app/package.json': '{"name":"example-app","private":true}',
        'app/index.js': 'export const port = 8080;\n',
    });
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code, result.stderr).toBe(0);
    const { settingsText } = initOutputSchema.parse(JSON.parse(result.stdout));
    const parsed = readSettings(settingsText, sandbox.path);
    expect(parsed.configurations).toContain('docker');
    expect(parsed.configurations).toContain('github-actions');
    expect(parsed.scopes.keys().toArray()).toContain('app');
});

test('init names an uninstalled tsconfig extension and the dependency install step', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"example-app","private":true}',
        'tsconfig.json': '{"extends":"@tsconfig/node22/tsconfig.json"}',
        'index.ts': 'export const port = 8080;\n',
    });
    const result = await runGspot(sandbox.path, ['init', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'configuration',
        message: expect.stringContaining('@tsconfig/node22/tsconfig.json') as string,
    });
});

test('init in a workspace whose root package.json holds only tools writes what the detection check expects', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'package.json': '{"name":"root","private":true,"devDependencies":{"typescript":"5.9.3"}}\n',
        'pnpm-workspace.yaml': 'packages:\n  - "packages/*"\n',
        'packages/a/package.json': '{"name":"a","version":"1.0.0","dependencies":{"is-number":"7.0.0"}}\n',
        'packages/a/src/util.js': 'export const value = 1;\n',
        'packages/b/package.json': '{"name":"b","version":"1.0.0","dependencies":{"is-number":"7.0.0"}}\n',
        'packages/b/src/util.js': 'export const value = 2;\n',
    });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toContain('@gspothq/cli');
    const checked = await runGspot(sandbox.path, ['check', '--only', 'gspot/detected-configurations']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
});

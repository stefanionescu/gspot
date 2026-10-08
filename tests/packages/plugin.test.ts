// The delivered plugin loads in both module systems and provides independent consumer types and presets.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runTestCommand } from '#tests/harness/command.ts';
import { getPublishedRelease } from '#tests/harness/release.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { consumerEnvironment } from '#tests/harness/environment.ts';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { CONSUMER, DECLARATIONS, pluginConsumerTools } from '#tests/config/packages/plugin.ts';

const release = getPublishedRelease();

async function expectPluginPayload(consumer: string): Promise<void> {
    const installedPlugin = join(consumer, 'node_modules', '@gspothq/eslint-plugin');
    expect(await readFile(join(installedPlugin, 'dist/LICENSE.md'), 'utf8')).toBe(
        await readFile(join(root, 'LICENSE.md'), 'utf8'),
    );
    expect(await readFile(join(installedPlugin, 'README.md'), 'utf8')).toBe(
        await readFile(join(root, 'packages/eslint-plugin/README.md'), 'utf8'),
    );
}

async function expectPluginExports(consumer: string): Promise<void> {
    await writeFile(join(consumer, 'consumer.mjs'), CONSUMER);
    await writeFile(join(consumer, 'consumer.mts'), DECLARATIONS);
    const options = { cwd: consumer, env: consumerEnvironment };
    const checked = await runTestCommand(['node', 'consumer.mjs'], options);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const typed = await runTestCommand(
        [
            'node',
            'node_modules/typescript/bin/tsc',
            '--noEmit',
            '--strict',
            '--module',
            'NodeNext',
            '--target',
            'ES2022',
            'consumer.mts',
        ],
        options,
    );
    expect(typed.code, typed.stdout + typed.stderr).toBe(0);
}

test('the installed plugin holds its license and documentation, loads as both module kinds, and enforces both levels', async () => {
    await using workspace = await testdir();
    const consumer = join(workspace.path, 'consumer');
    await mkdir(consumer);
    await writeFile(join(consumer, 'package.json'), '{"name":"plugin-consumer","private":true,"type":"module"}\n');
    const installed = await runTestCommand(
        [
            'npm',
            'install',
            `@gspothq/eslint-plugin@${release.version}`,
            ...pluginConsumerTools,
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
        ],
        {
            cwd: consumer,
            env: { ...consumerEnvironment, NPM_CONFIG_USERCONFIG: release.registry.npmrc },
        },
    );
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const installedPlugin = await lstat(join(consumer, 'node_modules', '@gspothq/eslint-plugin'));
    expect(installedPlugin.isSymbolicLink()).toBe(false);
    await expectPluginPayload(consumer);
    await expectPluginExports(consumer);
});

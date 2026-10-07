// The delivered plugin loads in both module systems and provides independent consumer types and presets.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runTestCommand } from '#tests/harness/command.ts';
import { getPublishedRelease } from '#tests/harness/release.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { consumerEnvironment } from '#tests/harness/environment.ts';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CONSUMER, DECLARATIONS, pluginConsumerTools } from '#tests/config/packages/plugin.ts';

const release = getPublishedRelease();

function expectPluginPayload(consumer: string): void {
    const installedPlugin = join(consumer, 'node_modules', '@gspothq/eslint-plugin');
    expect(readFileSync(join(installedPlugin, 'dist/LICENSE.md'), 'utf8')).toBe(
        readFileSync(join(root, 'LICENSE.md'), 'utf8'),
    );
    expect(readFileSync(join(installedPlugin, 'README.md'), 'utf8')).toBe(
        readFileSync(join(root, 'packages/eslint-plugin/README.md'), 'utf8'),
    );
}

async function expectPluginExports(consumer: string): Promise<void> {
    writeFileSync(join(consumer, 'consumer.mjs'), CONSUMER);
    writeFileSync(join(consumer, 'consumer.mts'), DECLARATIONS);
    const options = { cwd: consumer, env: consumerEnvironment, timeoutMs: NATIVE_TEST_TIMEOUT_MS };
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

test(
    'the installed plugin holds its license and documentation, loads as both module kinds, and enforces both levels',
    async () => {
        await using workspace = await testdir();
        const consumer = join(workspace.path, 'consumer');
        mkdirSync(consumer);
        writeFileSync(join(consumer, 'package.json'), '{"name":"plugin-consumer","private":true,"type":"module"}\n');
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
                timeoutMs: NATIVE_TEST_TIMEOUT_MS,
            },
        );
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(lstatSync(join(consumer, 'node_modules', '@gspothq/eslint-plugin')).isSymbolicLink()).toBe(false);
        expectPluginPayload(consumer);
        await expectPluginExports(consumer);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

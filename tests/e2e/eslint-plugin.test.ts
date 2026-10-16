import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runCommand } from '#tests/setup/processes.ts';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { packedEnvironment } from '#tests/setup/e2e-sandbox.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import workspacePackage from '#root-package' with { type: 'json' };
import { TYPE_PROGRAM, MODULE_PROGRAM } from '#tests/config/e2e.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };

/** The consumer installs tools separately from the plugin's runtime dependencies. */
const PEER_PACKAGES = [
    `eslint@${eslintPluginPackage.devDependencies.eslint}`,
    `typescript@${workspacePackage.devDependencies.typescript}`,
    `typescript-eslint@${testsPackage.devDependencies['typescript-eslint']}`,
];
{
    async function expectPluginExports(consumer: string): Promise<void> {
        await writeFile(join(consumer, 'consumer.mjs'), MODULE_PROGRAM);
        await writeFile(join(consumer, 'consumer.mts'), TYPE_PROGRAM);
        const options = { cwd: consumer, env: packedEnvironment };
        const checked = await runCommand(['node', 'consumer.mjs'], options);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const typed = await runCommand(
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

    test('the installed ESLint plugin loads through import and require and enforces both levels', async () => {
        await using workspace = await testdir();
        const consumer = join(workspace.path, 'consumer');
        await mkdir(consumer);
        await writeFile(join(consumer, 'package.json'), '{"name":"plugin-consumer","private":true,"type":"module"}\n');
        const installed = await runCommand(
            [
                'npm',
                'install',
                `@gspothq/eslint-plugin@${eslintPluginPackage.version}`,
                ...PEER_PACKAGES,
                '--ignore-scripts',
                '--no-audit',
                '--no-fund',
            ],
            {
                cwd: consumer,
                env: { ...packedEnvironment, NPM_CONFIG_USERCONFIG: buildSpawnEnvironment()['GSPOT_TEST_NPMRC'] },
            },
        );
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const installedPlugin = await lstat(join(consumer, 'node_modules', '@gspothq/eslint-plugin'));
        expect(installedPlugin.isSymbolicLink()).toBe(false);
        await expectPluginExports(consumer);
    });
}

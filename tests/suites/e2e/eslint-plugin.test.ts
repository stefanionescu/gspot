import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/system/processes.ts';
import { NPM_INSTALL_FLAGS } from '#tests/config/setup/sandboxes.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { userEnvironment } from '#tests/setup/sandboxes/user-project.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { PLUGIN_TYPES_SOURCE, PLUGIN_IMPORT_SCRIPT } from '#tests/config/e2e/eslint-plugin.ts';

async function assertPluginExports(consumer: string): Promise<void> {
    await writeFile(join(consumer, 'consumer.mjs'), PLUGIN_IMPORT_SCRIPT);
    await writeFile(join(consumer, 'consumer.mts'), PLUGIN_TYPES_SOURCE);
    const options = { cwd: consumer, env: userEnvironment };
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
    const peerPackages = [
        `eslint@${eslintPluginPackage.devDependencies.eslint}`,
        `typescript@${testsPackage.devDependencies.typescript}`,
        `typescript-eslint@${testsPackage.devDependencies['typescript-eslint']}`,
    ];
    const installed = await runCommand(
        [
            'npm',
            'install',
            `@gspothq/eslint-plugin@${eslintPluginPackage.version}`,
            ...peerPackages,
            ...NPM_INSTALL_FLAGS,
        ],
        { cwd: consumer, env: userEnvironment },
    );
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const installedPlugin = await lstat(join(consumer, 'node_modules', '@gspothq/eslint-plugin'));
    expect(installedPlugin.isSymbolicLink()).toBe(false);
    await assertPluginExports(consumer);
});

import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runCommand } from '#tests/setup/processes.ts';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { packedEnvironment } from '#tests/setup/packed-sandbox.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { TYPE_PROGRAM, MODULE_PROGRAM } from '#tests/data/packed-install.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };

async function assertPluginExports(consumer: string): Promise<void> {
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
    // The consumer installs tools separately from the plugin's runtime dependencies.
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
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
        ],
        {
            cwd: consumer,
            env: packedEnvironment,
        },
    );
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const installedPlugin = await lstat(join(consumer, 'node_modules', '@gspothq/eslint-plugin'));
    expect(installedPlugin.isSymbolicLink()).toBe(false);
    await assertPluginExports(consumer);
});

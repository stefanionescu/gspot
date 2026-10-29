import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { compareText } from '#cli/system/text.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { NPM_INSTALL_FLAGS } from '#tests/config/setup/sandboxes.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { buildProgramArguments } from '#tests/setup/system/programs.ts';
import { cp, lstat, mkdir, readdir, writeFile } from 'node:fs/promises';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { isolatedEnvironment } from '#tests/setup/sandboxes/projects/gspot.ts';
import { PLUGIN_TYPES_SOURCE, PLUGIN_PACKED_FILES } from '#tests/config/e2e/eslint-plugin.ts';

async function assertPluginExports(consumer: string): Promise<void> {
    const [program = ''] = buildProgramArguments('processes/eslint-plugin');
    await cp(program, join(consumer, 'consumer.ts'));
    await writeFile(join(consumer, 'consumer.mts'), PLUGIN_TYPES_SOURCE);
    const options = { cwd: consumer, env: isolatedEnvironment };
    const checked = await runCommand(['node', 'consumer.ts'], options);
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
        { cwd: consumer, env: isolatedEnvironment },
    );
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const installedPlugin = await lstat(join(consumer, 'node_modules', '@gspothq/eslint-plugin'));
    expect(installedPlugin.isSymbolicLink()).toBe(false);
    const installedPath = join(consumer, 'node_modules', '@gspothq/eslint-plugin');
    const files = await readdir(installedPath, { recursive: true, withFileTypes: true });
    expect(
        files
            .filter((file) => file.isFile())
            .map((file) => join(file.parentPath, file.name).slice(installedPath.length + 1))
            .toSorted(compareText),
    ).toStrictEqual([...PLUGIN_PACKED_FILES]);
    await assertPluginExports(consumer);
});

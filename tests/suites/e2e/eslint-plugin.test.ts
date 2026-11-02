import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { listPackagePins } from '#cli/tools/pins.ts';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { PLUGIN_TYPES_SOURCE } from '#tests/config/e2e.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { NPM_INSTALL_FLAGS } from '#tests/config/setup/sandboxes.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { isolatedEnvironment } from '#tests/setup/sandboxes/projects/gspot.ts';

async function assertPluginExports(consumer: string): Promise<void> {
    const [, program = ''] = buildProgramCommand('processes/eslint-plugin');
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
        `typescript-eslint@${listPackagePins(readConfigurations().values().toArray()).npm['typescript-eslint']!}`,
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
    await assertPluginExports(consumer);
});

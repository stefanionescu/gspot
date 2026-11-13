import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { readConfigurations } from '#cli/manifests/read.ts';
import { listPackagePins } from '#cli/tools/pins.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { PLUGIN_TYPES_SOURCE } from '#tests/config/e2e.ts';
import { NPM_INSTALL_FLAGS } from '#tests/config/setup/sandboxes.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { isolatedEnvironment } from '#tests/setup/sandboxes/projects/gspot.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

async function assertPluginExports(consumer: string): Promise<void> {
    await cp(join(REPOSITORY_ROOT, 'tests/setup/programs/checks/eslint-plugin.ts'), join(consumer, 'consumer.ts'));
    await writeFile(join(consumer, 'consumer.mts'), PLUGIN_TYPES_SOURCE);
    const options = { cwd: consumer, env: isolatedEnvironment };
    const checked = await runCommand(['node', 'consumer.ts'], options);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const finding = [{ line: 2, messageId: 'private' }];
    expect(JSON.parse(checked.stdout)).toStrictEqual([finding, finding, finding, finding]);
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
    const pins = listPackagePins(readConfigurations().values().toArray()).npm;
    const peerPackages = [
        `eslint@${eslintPluginPackage.devDependencies.eslint}`,
        `typescript@${pins['typescript']!}`,
        `typescript-eslint@${pins['typescript-eslint']!}`,
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

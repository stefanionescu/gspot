import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import cliPackage from '#cli-package' with { type: 'json' };
import { MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { LINE_BREAK } from '#cli/config/system.ts';
import { MISE_BIN_PATHS_ARGUMENTS, MISE_INSTALL_ARGUMENTS } from '#cli/config/tools/installers.ts';
import { listDistinctTools, readConfigurations } from '#cli/manifests/read.ts';
import { buildMiseInstall, findMisePin } from '#cli/tools/pins.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { GSPOT_LAUNCHER_PATH, MISE_TRUST, TOOL_PATHS_FILE } from '#tests/config/setup/sandboxes.ts';
import { runNpmPack } from '#tests/setup/runner/npm-registry.ts';
import { REPOSITORY_ROOT, TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { writeLauncher } from '#tests/setup/system/fakes.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

const TOOL_INSTALL_FOLDER = 'tools';

await runNpmPack(TEST_RUN_FOLDER, [
    { ...eslintPluginPackage, source: join(REPOSITORY_ROOT, 'packages/eslint-plugin') },
    { ...cliPackage, source: join(REPOSITORY_ROOT, 'packages/cli') },
]);

// The tests run in parallel, and two installs of one tool collide in the mise store, so each tool installs here first.
const paths = await installTestTools();

if (process.argv[2] !== 'e2e') {
    await writeLauncher(join(TEST_RUN_FOLDER, GSPOT_LAUNCHER_PATH), [
        'node',
        join(REPOSITORY_ROOT, 'packages/cli', cliPackage.bin.gspot),
    ]);
    await writeFile(join(TEST_RUN_FOLDER, TOOL_PATHS_FILE), paths.join('\n') + '\n');
}

async function installTestTools(): Promise<string[]> {
    const folder = join(TEST_RUN_FOLDER, TOOL_INSTALL_FOLDER);
    const config = join(folder, MISE_CONFIG_FILE);
    const env = { MISE_STATE_DIR: join(TEST_RUN_FOLDER, 'mise-state') };
    const configurations = readConfigurations().values().toArray();
    const names = listDistinctTools(configurations)
        .filter((tool) => tool.system !== true && hasToolBuild(tool.name))
        .flatMap((tool) => findMisePin(tool)?.name ?? []);
    await mkdir(folder);
    await writeFile(config, buildMiseInstall(configurations).content);
    for (const commandArguments of [
        [...MISE_TRUST, config],
        [...MISE_INSTALL_ARGUMENTS, ...names],
    ]) {
        const result = await runCommand(commandArguments, {
            cwd: folder,
            env,
        });
        process.stderr.write(result.stderr);
        if (result.code !== 0) throw new Error(`Test tools failed: ${result.stdout}${result.stderr}`);
    }
    const bins = await runCommand([...MISE_BIN_PATHS_ARGUMENTS, ...names], { cwd: folder, env });
    if (bins.code !== 0) throw new Error(`Test tool paths failed: ${bins.stdout}${bins.stderr}`);
    return bins.stdout.trim().split(LINE_BREAK);
}

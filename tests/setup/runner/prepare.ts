import { join } from 'node:path';
import { findMisePin } from '#cli/tools/pins.ts';
import { LINE_BREAK } from '#cli/config/system.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { hasToolBuild } from '#tests/setup/cli/tools.ts';
import { buildMiseInstall } from '#cli/tools/projects.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listDistinctTools } from '#cli/manifests/tools.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { writeLauncher } from '#tests/setup/system/programs.ts';
import { runNpmPack } from '#tests/setup/runner/npm-registry.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { REPOSITORY_ROOT, TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';
import { MISE_INSTALL_ARGUMENTS, MISE_BIN_PATHS_ARGUMENTS } from '#cli/config/tools/mise.ts';

import {
    MISE_TRUST,
    TOOL_PATHS_FILE,
    MISE_STATE_FOLDER,
    GSPOT_LAUNCHER_PATH,
    TOOL_INSTALL_FOLDER,
} from '#tests/config/setup/runner.ts';

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
    await writeFile(join(TEST_RUN_FOLDER, TOOL_PATHS_FILE), `${paths.join('\n')}\n`);
}

async function installTestTools(): Promise<string[]> {
    const folder = join(TEST_RUN_FOLDER, TOOL_INSTALL_FOLDER);
    const config = join(folder, MISE_CONFIG_FILE);
    const env = { MISE_STATE_DIR: join(TEST_RUN_FOLDER, MISE_STATE_FOLDER) };
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

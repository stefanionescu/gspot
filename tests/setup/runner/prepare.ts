import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import cliPackage from '#cli-package' with { type: 'json' };
import { readConfigurations } from '#cli/manifests/read.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { runNpmPack } from '#tests/setup/runner/npm-registry.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildMiseInstall } from '#cli/generation/tool-installs.ts';
import { MISE_BIN_PATHS_ARGUMENTS } from '#cli/config/executables.ts';
import { findMisePin, listDistinctTools } from '#cli/manifests/tools.ts';
import { MISE_INSTALL_ARGUMENTS } from '#cli/config/installers/installers.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { REPOSITORY_ROOT, TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';

import {
    LINE_BREAK,
    MISE_TRUST,
    TOOL_PINS_FILE,
    TOOL_PATHS_FILE,
    TOOL_INSTALL_FOLDER,
    GSPOT_LAUNCHER_PATH,
} from '#tests/config/setup/runner.ts';

await runNpmPack(TEST_RUN_FOLDER, [
    { ...eslintPluginPackage, source: join(REPOSITORY_ROOT, 'packages/eslint-plugin') },
    { ...cliPackage, source: join(REPOSITORY_ROOT, 'packages/cli') },
]);

await writeProgramCommand(TEST_RUN_FOLDER, GSPOT_LAUNCHER_PATH, 'processes/cli');

const paths = await installTestTools();

await writeFile(join(TEST_RUN_FOLDER, TOOL_PATHS_FILE), paths.join('\n') + '\n');

async function installTestTools(): Promise<string[]> {
    const folder = join(TEST_RUN_FOLDER, TOOL_INSTALL_FOLDER);
    const config = join(folder, TOOL_PINS_FILE);
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
            onStderr: (chunk) => {
                process.stderr.write(chunk);
            },
        });
        if (result.code !== 0) throw new Error(`Test tools failed: ${result.stdout}${result.stderr}`);
    }
    const bins = await runCommand([...MISE_BIN_PATHS_ARGUMENTS, ...names], { cwd: folder, env });
    if (bins.code !== 0) throw new Error(`Test tool paths failed: ${bins.stdout}${bins.stderr}`);
    return bins.stdout.trim().split(LINE_BREAK);
}

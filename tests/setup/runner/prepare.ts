import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import cliPackage from '#cli-package' with { type: 'json' };
import { runCommand } from '#tests/setup/system/processes.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { runNpmPack } from '#tests/setup/runner/npm-registry.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildMiseProject } from '#cli/generation/tool-projects.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { MISE_BIN_PATHS_ARGUMENTS } from '#cli/config/tools/locate.ts';
import { MISE_INSTALL_ARGUMENTS } from '#cli/config/installers/mise.ts';
import { findMisePin, listDistinctTools } from '#cli/configurations/tools.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { REPOSITORY_ROOT, TEST_RUN_FOLDER } from '#tests/setup/runner/run-folder.ts';

import {
    LINE_BREAK,
    MISE_TRUST,
    TOOL_PINS_FILE,
    TOOL_PATHS_FILE,
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
    const config = join(TEST_RUN_FOLDER, TOOL_PINS_FILE);
    const env = { MISE_STATE_DIR: join(TEST_RUN_FOLDER, 'mise-state') };
    const configurations = readConfigurations().values().toArray();
    const names = listDistinctTools(configurations)
        .filter((tool) => tool.system !== true && hasToolBuild(tool.name))
        .flatMap((tool) => findMisePin(tool)?.name ?? []);
    await writeFile(config, buildMiseProject(configurations).content);
    for (const commandArguments of [
        [...MISE_TRUST, config],
        [...MISE_INSTALL_ARGUMENTS, ...names],
    ]) {
        const result = await runCommand(commandArguments, {
            cwd: TEST_RUN_FOLDER,
            env,
            onStderr: (chunk) => {
                process.stderr.write(chunk);
            },
        });
        if (result.code !== 0) throw new Error(`Test tools failed: ${result.stdout}${result.stderr}`);
    }
    const bins = await runCommand([...MISE_BIN_PATHS_ARGUMENTS, ...names], { cwd: TEST_RUN_FOLDER, env });
    if (bins.code !== 0) throw new Error(`Test tool paths failed: ${bins.stdout}${bins.stderr}`);
    return bins.stdout.trim().split(LINE_BREAK);
}

// Bun prepares the packages, command launcher, and program tools once before the test workers start.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fakeTool } from '#tests/setup/fakes.ts';
import { CLI_MAIN } from '#tests/setup/run-gspot.ts';
import { runNpmPack } from '#tests/setup/registry.ts';
import { hasToolBuild } from '#tests/setup/system.ts';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { TEST_RUN_FOLDER } from '#tests/setup/install.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { buildMiseProject } from '#cli/generation/projects.ts';
import { MISE_INSTALL_ARGUMENTS } from '#cli/config/install/mise.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { runCommand, stopOnSignals } from '#tests/setup/processes.ts';
import { MISE_BIN_PATHS_ARGUMENTS } from '#cli/config/tools/inspection.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { findMisePin, listDistinctTools } from '#cli/configurations/declared-tools.ts';
import { MISE_TRUST, TOOL_PATHS_FILE, PINNED_TOOLS_FILE, GSPOT_LAUNCHER_PATH } from '#tests/data/test-setup.ts';

const controller = new AbortController();

using _signals = stopOnSignals((code) => {
    process.exitCode = code;
    controller.abort();
});

{
    const root = join(import.meta.dir, '../..');
    const folder = TEST_RUN_FOLDER;
    await rm(folder, { recursive: true, force: true });
    await mkdir(folder);
    await runNpmPack(folder, [
        { ...eslintPluginPackage, source: join(root, 'packages/eslint-plugin') },
        { ...cliPackage, source: join(root, 'packages/cli') },
    ]);
    await fakeTool(
        folder,
        GSPOT_LAUNCHER_PATH,
        `const { runProgram } = await import(${JSON.stringify(pathToFileURL(CLI_MAIN).href)}); process.exitCode = await runProgram(process.argv.slice(2));\n`,
    );
    const paths = await installPinnedTools(folder, controller.signal);
    await writeFile(join(folder, TOOL_PATHS_FILE), paths.join('\n') + '\n');
}

/** Install the program pins once for integration and end-to-end suites. */
async function installPinnedTools(folder: string, cancelSignal: AbortSignal): Promise<string[]> {
    const config = join(folder, PINNED_TOOLS_FILE);
    const configurations = [...readConfigurations().values()];
    const names = listDistinctTools(configurations)
        .filter((tool) => tool.system !== true && hasToolBuild(tool.name))
        .flatMap((tool) => findMisePin(tool)?.name ?? []);
    await writeFile(config, buildMiseProject(configurations).content);
    for (const commandArguments of [
        [...MISE_TRUST, config],
        [...MISE_INSTALL_ARGUMENTS, ...names],
    ]) {
        const result = await runCommand(commandArguments, {
            cwd: folder,
            cancelSignal,
            onStderr: (chunk) => {
                process.stderr.write(chunk);
            },
        });
        if (result.code !== 0) throw new Error(`Test tools failed: ${result.stdout}${result.stderr}`);
    }
    const bins = await runCommand([...MISE_BIN_PATHS_ARGUMENTS, ...names], { cwd: folder, cancelSignal });
    if (bins.code !== 0) throw new Error(`Test tool paths failed: ${bins.stdout}${bins.stderr}`);
    return bins.stdout.trim().split(/\r?\n/u);
}

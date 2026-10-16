// Bun prepares the packages, command launcher, and program tools once before the test workers start.
import { z } from 'zod';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { CLI_MAIN } from '#tests/setup/run-gspot.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import cliPackage from '#cli-package' with { type: 'json' };
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildMiseProject } from '#cli/generation/projects.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { hasToolBuild } from '#tests/setup/operating-systems.ts';
import type { PreparedSuite } from '#tests/types/preparation.ts';
import { packPackages, testRunFolder } from '#tests/setup/install.ts';
import { findMisePin, listDistinctTools } from '#cli/configurations/tools.ts';
import eslintPluginPackage from '#eslint-plugin-package' with { type: 'json' };

import {
    MISE_TRUST,
    MISE_INSTALL,
    MISE_BIN_PATHS,
    PREPARED_SUITES,
    TOOL_PATHS_FILE,
    TERMINATED_EXIT,
    INTERRUPTED_EXIT,
    PINNED_TOOLS_FILE,
    GSPOT_LAUNCHER_PATH,
} from '#tests/config/integration.ts';

const suiteSchema = z.enum(PREPARED_SUITES) satisfies z.ZodType<PreparedSuite>;
const controller = new AbortController();
const interrupt = (): void => {
    process.exitCode = INTERRUPTED_EXIT;
    controller.abort();
};
const terminate = (): void => {
    process.exitCode = TERMINATED_EXIT;
    controller.abort();
};
process.once('SIGINT', interrupt);
process.once('SIGTERM', terminate);
try {
    const suite = suiteSchema.parse(process.argv[2]);
    const root = join(import.meta.dir, '../..');
    const folder = testRunFolder();
    await rm(folder, { recursive: true, force: true });
    await mkdir(folder);
    await packPackages(
        folder,
        [
            { ...eslintPluginPackage, source: join(root, 'packages/eslint-plugin') },
            ...(suite === 'e2e' ? [{ ...cliPackage, source: join(root, 'packages/cli') }] : []),
        ],
        runCommand,
    );
    await fakeTool(folder, GSPOT_LAUNCHER_PATH, `await import(${JSON.stringify(pathToFileURL(CLI_MAIN).href)});\n`);
    const paths = await installPinnedTools(folder, controller.signal);
    await writeFile(join(folder, TOOL_PATHS_FILE), paths.join('\n') + '\n');
} finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', terminate);
}

/** Install the program pins once for integration and end-to-end suites. */
async function installPinnedTools(folder: string, cancelSignal: AbortSignal): Promise<string[]> {
    const config = join(folder, PINNED_TOOLS_FILE);
    const manifests = [...readManifests(createReadCache(process.cwd())).values()];
    const names = listDistinctTools(manifests)
        .filter((tool) => tool.system !== true && hasToolBuild(tool.name))
        .flatMap((tool) => findMisePin(tool)?.name ?? []);
    await writeFile(config, buildMiseProject(manifests, createReadCache(process.cwd())).content);
    for (const argv of [
        [...MISE_TRUST, config],
        [...MISE_INSTALL, ...names],
    ]) {
        const result = await runCommand(argv, {
            cwd: folder,
            cancelSignal,
            onStderr: (chunk) => {
                process.stderr.write(chunk);
            },
        });
        if (result.code !== 0) throw new Error(`Test tools failed: ${result.stdout}${result.stderr}`);
    }
    const bins = await runCommand([...MISE_BIN_PATHS, ...names], { cwd: folder, cancelSignal });
    if (bins.code !== 0) throw new Error(`Test tool paths failed: ${bins.stdout}${bins.stderr}`);
    return bins.stdout.trim().split(/\r?\n/u);
}

// Runs a gspot command from source with the workspace plugin served from a throwaway registry, so the tool lock of
// this repository resolves the plugin as it is built here. After install, the installed plugin must match the build.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { runSourceCommand } from '#registry/plugin.ts';
import { workspaceRoot } from '#automation/workspace.ts';
import { ARGUMENT_START } from '#automation/config/paths.ts';

import {
    NATIVE_TEST_TIMEOUT_MS,
    SOURCE_SUITE_TIMEOUT_MS,
    SOURCE_COMMAND_TIMEOUT_MS,
} from '#automation/config/plugin.ts';

const args = process.argv.slice(ARGUMENT_START);

if (args[0] === 'test') {
    const options = args.slice(1);
    if (options.length === 1 && options[0] === '--help') {
        console.log(
            'Usage: mise run test:tools -- [Bun options] [-- tools paths ...]\n\nPaths are relative to tests/. Without paths, tools is selected. Bun validates its options.',
        );
    } else {
        const separator = options.indexOf('--');
        const flags = separator === -1 ? options : options.slice(0, separator);
        const paths = separator === -1 ? [] : options.slice(separator + 1);
        process.exitCode = await runSourceCommand(
            [
                process.execPath,
                'test',
                '--timeout',
                String(NATIVE_TEST_TIMEOUT_MS),
                ...flags,
                ...(paths.length === 0 ? ['./tools'] : paths),
            ],
            join(workspaceRoot, 'tests'),
            SOURCE_SUITE_TIMEOUT_MS,
        );
    }
} else {
    process.exitCode = await runSourceCommand(
        [process.execPath, 'packages/cli/src/main.ts', ...args],
        workspaceRoot,
        SOURCE_COMMAND_TIMEOUT_MS,
    );
}
if (args[0] === 'install' && process.exitCode === 0) {
    for (const file of ['plugin.js', 'plugin.cjs', 'plugin.d.ts']) {
        const built = readFileSync(join(workspaceRoot, 'packages/eslint-plugin/dist', file));
        const installed = readFileSync(join(workspaceRoot, '.gspot/node_modules/@gspothq/eslint-plugin/dist', file));
        if (!built.equals(installed)) throw new Error(`Installed workspace plugin differs from the build: ${file}.`);
    }
    console.error('Installed workspace plugin matches the build.');
}

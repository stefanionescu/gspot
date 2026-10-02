// Runs a gspot command from source with the workspace plugin served from a throwaway registry, so the tool lock of
// this repository resolves the plugin as it is built here. After install, the installed plugin must match the build.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSourceCommand } from '#tests/harness/registry/plugin.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);

await runSourceCommand([process.execPath, 'packages/cli/src/main.ts', ...args], ROOT, 10 * 60_000);
if (args[0] === 'install' && (process.exitCode === undefined || process.exitCode === 0)) {
    for (const file of ['plugin.js', 'plugin.cjs', 'plugin.d.ts']) {
        const built = readFileSync(join(ROOT, 'packages/eslint-plugin/dist', file));
        const installed = readFileSync(join(ROOT, '.gspot/node_modules/@gspothq/eslint-plugin/dist', file));
        if (!built.equals(installed)) throw new Error(`Installed workspace plugin differs from the build: ${file}.`);
    }
    console.log('Installed workspace plugin matches the build.');
}

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSourceCommand } from '#tests/support/registry/plugin.ts';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

await runSourceCommand([process.execPath, 'packages/cli/src/main.ts', 'install'], ROOT, 5 * 60_000);
if (process.exitCode === undefined || process.exitCode === 0) {
    for (const file of ['plugin.js', 'plugin.cjs', 'plugin.d.ts']) {
        const built = readFileSync(join(ROOT, 'packages/eslint-plugin/dist', file));
        const installed = readFileSync(join(ROOT, '.gspot/node_modules/@gspot/eslint-plugin/dist', file));
        if (!built.equals(installed)) throw new Error(`Installed workspace plugin differs from the build: ${file}.`);
    }
    console.log('Installed workspace plugin matches the build.');
}

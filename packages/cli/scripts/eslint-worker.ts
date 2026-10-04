import { fileURLToPath } from 'node:url';
import { ESLINT_WORKER_FILES } from '#cli/config/tools/eslint.ts';

/**
 * Bundle the Node worker and its static dependencies for npm and standalone delivery.
 * @param destination the folder receiving worker.js
 */
export async function buildEslintWorker(destination: string): Promise<void> {
    const source = new URL(`../src/tools/eslint/${ESLINT_WORKER_FILES.source}`, import.meta.url);
    const result = await Bun.build({
        entrypoints: [fileURLToPath(source)],
        outdir: destination,
        naming: ESLINT_WORKER_FILES.bundle,
        format: 'esm',
        target: 'node',
        minify: false,
        sourcemap: 'none',
    });
    if (!result.success) throw new Error(result.logs.map((log) => log.message).join('\n'));
}

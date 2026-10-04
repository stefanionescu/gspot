import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetPath } from '#cli/platform/assets.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { PRIVATE_FILE } from '#cli/config/platform/root.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { ESLINT_WORKER_FILES } from '#cli/config/tools/eslint.ts';
import { STANDALONE_BUILD } from '#cli/config/platform/assets.ts';
import type { EslintCoverageRequest } from '#cli/types/parsers/eslint.ts';

/**
 * Resolve active ESLint rules with captured logs and a separate structured result.
 * @param request the repository and files whose ESLint rules to resolve
 * @param run the check's inspected tool runner with its deadline and cancellation
 * @returns the structured result the process reported
 */
export async function readEslintCoverage(
    request: EslintCoverageRequest,
    run: (command: string[]) => Promise<SpawnResult>,
): Promise<unknown> {
    using workFolder = scratchFolder('gspot-eslint-coverage-');
    const work = workFolder.path;
    using files = openRoot(work);
    files.write('request.json', { bytes: Buffer.from(JSON.stringify(request)), mode: PRIVATE_FILE }, undefined);
    const program = import.meta.url.endsWith('.ts') ? ESLINT_WORKER_FILES.source : ESLINT_WORKER_FILES.bundle;
    const worker = STANDALONE_BUILD
        ? assetPath(ESLINT_WORKER_FILES.bundle)
        : fileURLToPath(new URL(program, import.meta.url));
    const result = await run(['node', worker, join(work, 'request.json'), join(work, 'result.json')]);
    if (result.code !== 0)
        throw new Error(
            `ESLint rule coverage failed: ${result.stderr.trim() || 'The ESLint process did not complete.'}`,
        );
    const output = files.read('result.json');
    if (output === undefined) throw new Error('ESLint rule coverage did not produce a result.');
    return JSON.parse(output.bytes.toString('utf8')) as unknown;
}

import type { z } from 'zod';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runToolCommand } from '#cli/tools/command.ts';
import { PRIVATE_FILE } from '#cli/config/platform/root.ts';
import type { MergedView } from '#cli/types/policy/policy.ts';
import { openRoot, scratchFolder } from '#cli/platform/filesystem.ts';
import type { configurationRequest } from '#cli/lifecycle/preview/eslint/protocol.ts';

/**
 * Evaluate authored configuration with captured logs and a separate structured result.
 * @param request what to evaluate, in the configuration process
 * @param view the merged view whose deadline applies
 * @param cancelSignal cancellation for the process
 * @returns the structured result the process reported
 */
export async function evaluate(
    request: z.infer<typeof configurationRequest>,
    view?: Pick<MergedView, 'settings'>,
    cancelSignal?: AbortSignal,
): Promise<unknown> {
    // The program is the TypeScript module in the source tree, or its build beside the bundle.
    const program = import.meta.url.endsWith('.ts') ? 'worker.ts' : 'configuration.js';
    using workFolder = scratchFolder('gspot-configuration-');
    const work = workFolder.path;
    using files = openRoot(work);
    files.write('request.json', { bytes: Buffer.from(JSON.stringify(request)), mode: PRIVATE_FILE }, undefined);
    const result = await runToolCommand(
        view,
        [
            process.execPath,
            ...('bun' in process.versions ? ['--no-install'] : []),
            fileURLToPath(new URL(program, import.meta.url)),
            join(work, 'request.json'),
            join(work, 'result.json'),
        ],
        { cwd: request.root },
        cancelSignal,
    );
    if (result.code !== 0 || result.isTimedOut === true || result.isCanceled === true)
        throw new Error(
            `Tool configuration evaluation failed: ${result.stderr.trim() || 'The configuration process did not complete.'}`,
        );
    const output = files.read('result.json');
    if (output === undefined) throw new Error('Tool configuration evaluation did not produce a result.');
    return JSON.parse(output.bytes.toString('utf8')) as unknown;
}

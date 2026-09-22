import type { MergedView } from '#cli/policy/types.ts';
import type { z } from 'zod';
import { isEmbedded, readAsset } from '#cli/platform/assets.ts';
import { runToolCommand } from '#cli/run/tool-runner.ts';
import type { configurationRequest } from './configuration-request.ts';

/** Evaluate authored configuration with captured logs and a separate structured result. */
export async function evaluateConfiguration(
    request: z.infer<typeof configurationRequest>,
    view?: Pick<MergedView, 'limit'>,
    cancelSignal?: AbortSignal,
): Promise<unknown> {
    const program = isEmbedded()
        ? readAsset('packages/cli/build/configuration-process.js')
        : `await import(${JSON.stringify(new URL('./configuration-process.ts', import.meta.url).href)});`;
    const result = await runToolCommand(
        view,
        [process.execPath, '--no-install', 'run', '-'],
        {
            cwd: request.root,
            env: { BUN_BE_BUN: '1' },
            stdin: `globalThis.gspotConfigurationRequest = ${JSON.stringify(request)};\n${program}`,
            captureFd3: true,
        },
        cancelSignal,
    );
    if (result.code !== 0 || result.isTimedOut === true || result.isCanceled === true)
        throw new Error(
            `Tool configuration evaluation failed: ${result.stderr.trim() || 'The configuration process did not complete.'}`,
        );
    return JSON.parse(result.fd3 ?? 'null') as unknown;
}

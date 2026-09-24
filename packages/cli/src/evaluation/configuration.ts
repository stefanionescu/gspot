import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import { isEmbedded, readAsset } from '#cli/platform/assets.ts';
import { runToolCommand } from '#cli/run/tool-runner.ts';
import type { configurationRequest } from '#cli/schemas/evaluation.ts';
import type { MergedView } from '#cli/types/policy.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { z } from 'zod';

/** Evaluate authored configuration with captured logs and a separate structured result. */
export async function evaluateConfiguration(
    request: z.infer<typeof configurationRequest>,
    view?: Pick<MergedView, 'limit'>,
    cancelSignal?: AbortSignal,
): Promise<unknown> {
    const program = isEmbedded()
        ? readAsset('packages/cli/build/configuration-process.js')
        : `await import(${JSON.stringify(new URL('./process.ts', import.meta.url).href)});`;
    const work = mkdtempSync(join(tmpdir(), 'gspot-configuration-'));
    const files = openConfinedRoot(work);
    try {
        const result = await runToolCommand(
            view,
            [process.execPath, '--no-install', 'run', '-'],
            {
                cwd: request.root,
                env: { BUN_BE_BUN: '1' },
                stdin: `globalThis.gspotConfigurationRequest = ${JSON.stringify(request)};\nglobalThis.gspotConfigurationOutput = ${JSON.stringify(join(work, 'result.json'))};\n${program}`,
            },
            cancelSignal,
        );
        if (result.code !== 0 || result.isTimedOut === true || result.isCanceled === true)
            throw new Error(
                `Tool configuration evaluation failed: ${result.stderr.trim() || 'The configuration process did not complete.'}`,
            );
        const output = files.read('result.json');
        if (output === undefined) throw new Error('Tool configuration evaluation did not produce a result.');
        return JSON.parse(output.bytes.toString('utf8')) as unknown;
    } finally {
        files.close();
        rmSync(work, { recursive: true, force: true });
    }
}

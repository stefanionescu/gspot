import { z } from 'zod';
import { dirname, basename } from 'node:path';
import { PRIVATE_FILE } from '#cli/config/platform.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { runRuleCoverage } from '#cli/native/eslint.ts';
import { runEslintPreview } from '#cli/native/eslint-preview.ts';
import { configurationRequest, eslintPreviewResponse, eslintCoverageResponse } from '#cli/native/protocol.ts';

// Evaluates the operation the request names and checks the answer against its response shape.
async function evaluate(request: z.infer<typeof configurationRequest>, output: string): Promise<unknown> {
    if (request.operation === 'preview-rules')
        return eslintPreviewResponse.parse(await runEslintPreview(request, dirname(output)));
    return eslintCoverageResponse.parse(await runRuleCoverage(request));
}

try {
    const request = configurationRequest.parse(
        (globalThis as { gspotConfigurationRequest?: unknown }).gspotConfigurationRequest,
    );
    const output = z
        .string()
        .min(1)
        .parse((globalThis as { gspotConfigurationOutput?: unknown }).gspotConfigurationOutput);
    const result = await evaluate(request, output);
    const files = openRoot(dirname(output));
    try {
        files.write(basename(output), { bytes: Buffer.from(JSON.stringify(result)), mode: PRIVATE_FILE }, undefined);
    } finally {
        files.close();
    }
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
}

import { z } from 'zod';
import { dirname, basename } from 'node:path';
import { runLicenses } from '#cli/native/license.ts';
import { PRIVATE_FILE } from '#cli/config/platform.ts';
import { runStylelint } from '#cli/native/stylelint.ts';
import type { EvaluationRequest } from '#cli/types/native.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { runEslintPreview } from '#cli/native/eslint-preview.ts';
import { runEslint, runRuleCoverage } from '#cli/native/eslint.ts';
import { runFormat, runIgnoredPaths } from '#cli/native/format.ts';

import {
    eslintResponse,
    formatResponse,
    licenseResponse,
    stylelintResponse,
    configurationRequest,
    ignoredPathsResponse,
    eslintPreviewResponse,
    eslintCoverageResponse,
} from '#cli/native/protocol.ts';

// Evaluates the operation the request names and checks the answer against its response shape.
async function evaluate(request: EvaluationRequest, output: string): Promise<unknown> {
    switch (request.operation) {
        case 'preview-rules': {
            return eslintPreviewResponse.parse(await runEslintPreview(request, dirname(output)));
        }
        case 'stylelint': {
            return stylelintResponse.parse(await runStylelint(request));
        }
        case 'licenses': {
            return licenseResponse.parse(await runLicenses(request));
        }
        case 'coverage': {
            return eslintCoverageResponse.parse(await runRuleCoverage(request));
        }
        case 'ignore': {
            return ignoredPathsResponse.parse(await runIgnoredPaths(request));
        }
        case 'format': {
            return formatResponse.parse(await runFormat(request));
        }
        default: {
            return eslintResponse.parse(await runEslint(request));
        }
    }
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
    const files = openConfinedRoot(dirname(output));
    try {
        files.write(basename(output), { bytes: Buffer.from(JSON.stringify(result)), mode: PRIVATE_FILE }, undefined);
    } finally {
        files.close();
    }
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
}

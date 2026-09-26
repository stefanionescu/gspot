import { z } from 'zod';
import { basename, dirname } from 'node:path';
import { PRIVATE_FILE } from '#cli/constants/platform.ts';
import { evaluateLicenses } from '#cli/evaluation/license.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { evaluateStylelint } from '#cli/evaluation/stylelint.ts';
import type { EvaluationRequest } from '#cli/types/evaluation.ts';
import { evaluateEslintPreview } from '#cli/evaluation/eslint-preview.ts';
import { evaluateEslint, evaluateRuleCoverage } from '#cli/evaluation/eslint.ts';
import { evaluateFormat, evaluateIgnoredPaths } from '#cli/evaluation/format.ts';

import {
    eslintResponse,
    eslintPreviewResponse,
    licenseResponse,
    stylelintResponse,
    configurationRequest,
    eslintCoverageResponse,
    formatResponse,
    ignoredPathsResponse,
} from '#cli/evaluation/protocol.ts';

// Evaluates the operation the request names and checks the answer against its response shape.
async function evaluate(request: EvaluationRequest, output: string): Promise<unknown> {
    switch (request.operation) {
        case 'preview-rules': {
            return eslintPreviewResponse.parse(await evaluateEslintPreview(request, dirname(output)));
        }
        case 'stylelint': {
            return stylelintResponse.parse(await evaluateStylelint(request));
        }
        case 'licenses': {
            return licenseResponse.parse(await evaluateLicenses(request));
        }
        case 'coverage': {
            return eslintCoverageResponse.parse(await evaluateRuleCoverage(request));
        }
        case 'ignore': {
            return ignoredPathsResponse.parse(await evaluateIgnoredPaths(request));
        }
        case 'format': {
            return formatResponse.parse(await evaluateFormat(request));
        }
        default: {
            return eslintResponse.parse(await evaluateEslint(request));
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

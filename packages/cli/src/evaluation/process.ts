import { evaluateEslint, evaluateRuleCoverage } from '#cli/evaluation/eslint.ts';
import { evaluateFormat, evaluateIgnoredPaths } from '#cli/evaluation/format.ts';
import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import {
    configurationRequest,
    eslintCoverageResponse,
    formatResponse,
    ignoredPathsResponse,
} from '#cli/schemas/evaluation.ts';
import { basename, dirname } from 'node:path';
import { z } from 'zod';

import { eslintResponse } from '#cli/schemas/evaluation.ts';

import { evaluateEslintPreview } from '#cli/evaluation/eslint-preview.ts';
import { evaluateLicenses } from '#cli/evaluation/license.ts';
import { evaluateStylelint } from '#cli/evaluation/stylelint.ts';
import { eslintPreviewResponse, licenseResponse, stylelintResponse } from '#cli/schemas/evaluation.ts';

try {
    const request = configurationRequest.parse(
        (globalThis as { gspotConfigurationRequest?: unknown }).gspotConfigurationRequest,
    );
    const output = z
        .string()
        .min(1)
        .parse((globalThis as { gspotConfigurationOutput?: unknown }).gspotConfigurationOutput);
    const result =
        request.operation === 'preview-rules'
            ? eslintPreviewResponse.parse(await evaluateEslintPreview(request, dirname(output)))
            : request.operation === 'stylelint'
              ? stylelintResponse.parse(await evaluateStylelint(request))
              : request.operation === 'licenses'
                ? licenseResponse.parse(await evaluateLicenses(request))
                : request.operation === 'coverage'
                  ? eslintCoverageResponse.parse(await evaluateRuleCoverage(request))
                  : request.operation === 'ignore'
                    ? ignoredPathsResponse.parse(await evaluateIgnoredPaths(request))
                    : request.operation === 'format'
                      ? formatResponse.parse(await evaluateFormat(request))
                      : eslintResponse.parse(await evaluateEslint(request));
    const files = openConfinedRoot(dirname(output));
    try {
        files.write(basename(output), { bytes: Buffer.from(JSON.stringify(result)), mode: 0o600 }, undefined);
    } finally {
        files.close();
    }
    process.exit(0);
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}

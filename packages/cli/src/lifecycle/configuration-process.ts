import { z } from 'zod';
import { dirname, basename } from 'node:path';
import { openConfinedRoot } from './confined.ts';
import { evaluateFormat, evaluateIgnoredPaths } from './format-evaluation.ts';
import { evaluateEslint, evaluateRuleCoverage, eslintCoverageResponse } from './eslint-evaluation.ts';
import { configurationRequest } from './configuration-request.ts';
import { formatResponse, ignoredPathsResponse } from './format-evaluation.ts';
import { eslintResponse } from './eslint-evaluation.ts';
import { evaluateLicenses, licenseResponse } from './license-evaluation.ts';
import { evaluateStylelint, stylelintResponse } from './stylelint-evaluation.ts';
import { evaluateEslintPreview, eslintPreviewResponse } from './eslint-preview.ts';

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

import { writeFileSync } from 'node:fs';
import { evaluateFormat, evaluateIgnoredPaths } from './format-evaluation.ts';
import { evaluateEslint } from './eslint-evaluation.ts';
import { configurationRequest } from './configuration-request.ts';
import { formatResponse, ignoredPathsResponse } from './format-evaluation.ts';
import { eslintResponse } from './eslint-evaluation.ts';

try {
    const request = configurationRequest.parse(
        (globalThis as { gspotConfigurationRequest?: unknown }).gspotConfigurationRequest,
    );
    const result =
        request.operation === 'ignore'
            ? ignoredPathsResponse.parse(await evaluateIgnoredPaths(request))
            : request.operation === 'format'
              ? formatResponse.parse(await evaluateFormat(request))
              : eslintResponse.parse(await evaluateEslint(request));
    writeFileSync(3, JSON.stringify(result));
    process.exit(0);
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}

import { z } from 'zod';
import type * as Eslint from 'eslint';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { join, dirname, basename } from 'node:path';
import { ACTIVE_LEVELS } from '#cli/config/native.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { PRIVATE_FILE, ARGUMENT_START } from '#cli/config/platform.ts';
import { runEslintPreview } from '#cli/lifecycle/preview/eslint/declarations.ts';
import type { eslintCoverageRequest } from '#cli/lifecycle/preview/eslint/protocol.ts';

import {
    configurationRequest,
    eslintPreviewResponse,
    eslintCoverageResponse,
} from '#cli/lifecycle/preview/eslint/protocol.ts';

// Evaluates the operation the request names and checks the answer against its response shape.
async function evaluate(request: z.infer<typeof configurationRequest>, output: string): Promise<unknown> {
    if (request.operation === 'preview-rules')
        return eslintPreviewResponse.parse(await runEslintPreview(request, dirname(output)));
    return eslintCoverageResponse.parse(await runRuleCoverage(request));
}

try {
    const [requestPath, output] = z
        .tuple([z.string().min(1), z.string().min(1)])
        .parse(process.argv.slice(ARGUMENT_START));
    const request = configurationRequest.parse(JSON.parse(readFileSync(requestPath, 'utf8')));
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

/**
 * Resolve every selected file with one native ESLint instance in an isolated configuration process.
 * @param request the repository root, the configuration, and the files whose rules to resolve
 * @returns the rules in force for each file
 */
export async function runRuleCoverage(
    request: z.infer<typeof eslintCoverageRequest>,
): Promise<z.infer<typeof eslintCoverageResponse>> {
    if (openRoot(request.root).read('.gspot/config/eslint.config.mjs') === undefined)
        throw new Error('The generated ESLint configuration is missing. Run: gspot apply');
    const require = createRequire(join(request.root, '.gspot/package.json'));
    const module = (await import(pathToFileURL(require.resolve('eslint')).href)) as typeof Eslint;
    const eslintClass = await module.loadESLint({ useFlatConfig: true });
    const eslint = new eslintClass({
        cwd: request.root,
        overrideConfigFile: join(request.root, '.gspot/config/eslint.config.mjs'),
    });
    const result: Record<string, string[]> = {};
    for (const path of request.paths) {
        const config = (await eslint.calculateConfigForFile(path)) as { rules?: Record<string, unknown> } | undefined;
        if (config === undefined) throw new Error(`ESLint did not resolve a configuration for ${path}.`);
        result[path] = Object.entries(config.rules ?? {}).flatMap(([name, entry]) => {
            const level = Array.isArray(entry) ? (entry[0] as unknown) : entry;
            return ACTIVE_LEVELS.has(level) ? [name] : [];
        });
    }
    return result;
}

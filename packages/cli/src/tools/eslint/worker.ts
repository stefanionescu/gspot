import type * as Eslint from 'eslint';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { join, dirname, basename } from 'node:path';
import { openRoot } from '#cli/platform/root/open.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import { ACTIVE_SEVERITIES } from '#cli/config/tools/eslint.ts';
import { PROGRAM_ARGUMENT_OFFSET } from '#cli/config/platform/runtime.ts';
import { ESLINT_FILE, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';
import type { EslintCoverageRequest, EslintCoverageResponse } from '#cli/types/parsers/eslint.ts';

import {
    workerArgumentsSchema,
    eslintCoverageRequestSchema,
    eslintCoverageResponseSchema,
    eslintResolvedConfigurationSchema,
} from '#cli/parsers/schema/eslint.ts';

/**
 * Resolve every selected file with one native ESLint instance in an isolated configuration process.
 * @param request the repository root, the configuration, and the files whose rules to resolve
 * @returns the rules in force for each file
 */
async function readActiveRules(request: EslintCoverageRequest): Promise<EslintCoverageResponse> {
    using repository = openRoot(request.root);
    if (repository.read(ESLINT_FILE) === undefined)
        throw new Error('The generated ESLint configuration is missing. Run: gspot apply');
    const require = createRequire(join(request.root, TOOL_PACKAGE_PROJECT));
    const module = (await import(pathToFileURL(require.resolve('eslint')).href)) as typeof Eslint;
    const eslint = new (await module.loadESLint({ useFlatConfig: true }))({
        cwd: request.root,
        overrideConfigFile: join(request.root, ESLINT_FILE),
    });
    const result: Record<string, string[]> = {};
    for (const path of request.paths) {
        const config = eslintResolvedConfigurationSchema.parse(await eslint.calculateConfigForFile(path));
        if (config === undefined) throw new Error(`ESLint did not resolve a configuration for ${path}.`);
        result[path] = (config.rules === undefined ? [] : Object.entries(config.rules)).flatMap(([name, entry]) => {
            const level: unknown = Array.isArray(entry) ? entry[0] : entry;
            return ACTIVE_SEVERITIES.has(level) ? [name] : [];
        });
    }
    return result;
}

try {
    const [requestPath, output] = workerArgumentsSchema.parse(process.argv.slice(PROGRAM_ARGUMENT_OFFSET));
    const request = eslintCoverageRequestSchema.parse(JSON.parse(readFileSync(requestPath, 'utf8')));
    const result = eslintCoverageResponseSchema.parse(await readActiveRules(request));
    using files = openRoot(dirname(output));
    files.write(basename(output), { bytes: Buffer.from(JSON.stringify(result)), mode: PRIVATE_FILE }, undefined);
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
}

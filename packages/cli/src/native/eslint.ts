import type { z } from 'zod';
import { join } from 'node:path';
import type * as Eslint from 'eslint';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { ACTIVE_LEVELS } from '#cli/config/native.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { eslintCoverageRequest, eslintCoverageResponse } from '#cli/native/protocol.ts';

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

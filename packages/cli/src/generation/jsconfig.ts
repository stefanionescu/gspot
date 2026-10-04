import { toPosix } from '#cli/platform/paths.ts';
import { join, dirname, relative } from 'node:path';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import type { Policy } from '#cli/types/policy/settings.ts';

import {
    JAVASCRIPT_IMPORTS,
    JAVASCRIPT_OPTIONS,
    JAVASCRIPT_EXCLUSIONS,
    JAVASCRIPT_EXTENSIONS,
} from '#cli/config/generation/typescript.ts';

/**
 * Generates JavaScript compiler settings using the scope's authored resolution and input selection.
 * @param root the repository root
 * @param policy the repository policy
 * @param target the path of the generated file
 * @param scope the scope path, '' for the root
 * @returns the jsconfig contents
 */
export function javascriptConfiguration(
    root: string,
    policy: Policy,
    target: string,
    scope: string,
): Record<string, unknown> {
    const config = getTsconfig(root, join(root, scope, 'jsconfig.json'));
    const prefix = toPosix(relative(dirname(target), scope || '.')) + '/';
    const compilerOptions = { ...JAVASCRIPT_OPTIONS };
    const configuration: Record<string, unknown> = { compilerOptions };
    if (config === undefined) {
        Object.assign(compilerOptions, JAVASCRIPT_IMPORTS);
        configuration['exclude'] = [
            ...JAVASCRIPT_EXCLUSIONS,
            ...policy.declarations.flatMap((entry) => entry.paths),
        ].map((path) => `${prefix}${path}`);
    } else configuration['extends'] = `${prefix}jsconfig.json`;
    const raw: unknown = config?.raw;
    const listsSources = typeof raw === 'object' && raw !== null && ('files' in raw || 'include' in raw);
    if (!listsSources)
        configuration['include'] = JAVASCRIPT_EXTENSIONS.map((extension) => `${prefix}**/*.${extension}`);
    return configuration;
}

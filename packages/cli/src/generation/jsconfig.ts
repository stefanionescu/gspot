import { toPosix } from '#cli/platform/paths.ts';
import { join, dirname, relative } from 'node:path';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import type { JsconfigInput } from '#cli/types/generation/jsconfig.ts';

import {
    JAVASCRIPT_IMPORTS,
    JAVASCRIPT_OPTIONS,
    JAVASCRIPT_EXCLUSIONS,
    JAVASCRIPT_EXTENSIONS,
} from '#cli/config/generation/typescript.ts';

/**
 * Generates JavaScript compiler settings using the scope's authored resolution and input selection.
 * @param input the repository root, generated target, authored scope, and declaration paths to exclude
 * @returns the jsconfig contents
 */
export function buildJsconfig(input: JsconfigInput): Record<string, unknown> {
    const { root, declarationPaths, target, scope } = input;
    const authored = getTsconfig(root, join(root, scope, 'jsconfig.json'));
    const prefix = toPosix(relative(dirname(target), scope || '.')) + '/';
    const compilerOptions = { ...JAVASCRIPT_OPTIONS };
    const jsconfig: Record<string, unknown> = { compilerOptions };
    if (authored === undefined) {
        Object.assign(compilerOptions, JAVASCRIPT_IMPORTS);
        jsconfig['exclude'] = [...JAVASCRIPT_EXCLUSIONS, ...declarationPaths].map((path) => `${prefix}${path}`);
    } else jsconfig['extends'] = `${prefix}jsconfig.json`;
    const raw: unknown = authored?.raw;
    const hasSourceSelection = typeof raw === 'object' && raw !== null && ('files' in raw || 'include' in raw);
    if (!hasSourceSelection)
        jsconfig['include'] = JAVASCRIPT_EXTENSIONS.map((extension) => `${prefix}**/*.${extension}`);
    return jsconfig;
}

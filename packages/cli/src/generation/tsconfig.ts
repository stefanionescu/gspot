import ts from 'typescript';
import { join, dirname, relative } from 'node:path';
import { scopeOf } from '#cli/repository/paths/contracts.ts';
import { getTsconfig } from '#cli/parsers/packages/public.ts';
import { toPosix, extensionOf } from '#cli/platform/contracts.ts';
import type { Level, Manifest } from '#cli/types/configurations.ts';
import type { TsconfigInput } from '#cli/types/generation/tsconfig.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import { COMPILER_OPTIONS, RECOMMENDED_OPTIONS, TYPESCRIPT_DEFAULTS } from '#cli/config/generation/typescript.ts';

/**
 * Preserve authored projects and supply a standalone source project when the scope has none.
 * @param input the scope's source inventory, generated target and required options
 * @returns the native compiler configuration
 */
export function buildTsconfig(input: TsconfigInput): Record<string, unknown> {
    const { root, reads, target, scope, files, scopeEntries, options } = input;
    const authored = getTsconfig(root, join(root, scope, 'tsconfig.json'), reads);
    const prefix = toPosix(relative(dirname(target), scope || '.')) + '/';
    if (authored !== undefined) return { extends: `${prefix}tsconfig.json`, compilerOptions: options };
    const projectRoots = ts.getEffectiveTypeRoots({}, { getCurrentDirectory: () => join(root, scope) }) ?? [];
    const sources = files.filter(
        (file) =>
            file.kind === 'source' &&
            (file.tags.includes('typescript') || DECLARATION_EXTENSIONS.includes(extensionOf(file.path))) &&
            scopeOf(file.path, scopeEntries).path === scope,
    );
    return {
        compilerOptions: {
            ...TYPESCRIPT_DEFAULTS,
            ...options,
            typeRoots: projectRoots.map((path) => toPosix(relative(join(root, dirname(target)), path))),
        },
        files: sources.map((file) => toPosix(relative(dirname(target), file.path))),
    };
}

/**
 * Required compiler diagnostics and framework settings for generation and authored option auditing.
 * @param level the selected check level
 * @param selected the applicable configuration manifests
 * @returns the required compiler options
 */
export function requiredTsconfigOptions(level: Level, selected: Manifest[]): Record<string, boolean> {
    const options: Record<string, boolean> = { ...(level === 'all' ? COMPILER_OPTIONS : RECOMMENDED_OPTIONS) };
    for (const manifest of selected) Object.assign(options, manifest.compiler_options);
    return options;
}

import ts from 'typescript';
import { join, dirname, relative } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import { getTsconfig } from '#cli/repository/tsconfig.ts';
import { toPosix, extensionOf } from '#cli/platform/paths.ts';
import type { TsconfigInput } from '#cli/types/generation/tsconfig.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import { TYPESCRIPT_DEFAULTS } from '#cli/config/generation/typescript.ts';

/**
 * Preserve authored projects and supply a standalone source project when the scope has none.
 * @param input the scope's source inventory, generated target and required options
 * @returns the native compiler configuration
 */
export function buildTsconfig(input: TsconfigInput): Record<string, unknown> {
    const { root, target, scope, files, scopeEntries, options } = input;
    const authored = getTsconfig(root, join(root, scope, 'tsconfig.json'));
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

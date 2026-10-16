import ts from 'typescript';
import { findScope } from '#cli/repository/scopes.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import type { Level, Manifest } from '#cli/types/configurations.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import type { TsconfigInput } from '#cli/types/generation/typescript.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';

import {
    COMPILER_OPTIONS,
    RECOMMENDED_OPTIONS,
    TYPESCRIPT_DEFAULTS,
    NESTJS_CONFIGURATION,
    NESTJS_COMPILER_OPTIONS,
} from '#cli/config/generation/typescript.ts';

/**
 * Preserve authored projects and supply a standalone source project when the scope has none.
 *
 * @param input the scope's source inventory, generated target, and required options.
 *
 * @returns the compiler configuration.
 */
export function buildTsconfig(input: TsconfigInput): Record<string, unknown> {
    const { root, typeRootsFolder, reads, target, scope, files, scopeEntries, options } = input;
    const authored = readTsconfigProject(
        root,
        scope,
        files
            .filter(
                (file) =>
                    (file.tags.includes('typescript') || DECLARATION_EXTENSIONS.has(extractExtension(file.path))) &&
                    findScope(file.path, scopeEntries).path === scope,
            )
            .map((file) => file.path),
        reads,
    );
    const projectRoots =
        ts.getEffectiveTypeRoots(
            {},
            {
                getCurrentDirectory: () =>
                    join(typeRootsFolder, authored === undefined ? scope : relative(root, dirname(authored.path))),
            },
        ) ?? [];
    const folder = dirname(resolve(root, target));
    const typeRoots = projectRoots.map((path) => convertToPosixPath(relative(folder, path)));
    if (authored !== undefined)
        return {
            extends: convertToPosixPath(relative(folder, authored.path)),
            files: authored.config.fileNames.map((path) => convertToPosixPath(relative(folder, path))),
            compilerOptions: {
                ...(authored.config.options.typeRoots === undefined ? { typeRoots } : {}),
            },
        };
    const sources = files.filter(
        (file) =>
            file.kind === 'source' &&
            (file.tags.includes('typescript') || DECLARATION_EXTENSIONS.has(extractExtension(file.path))) &&
            findScope(file.path, scopeEntries).path === scope,
    );
    // Svelte reads these extra extensions through include; tsc ignores them as unsupported sources.
    const components = files.filter(
        (file) =>
            file.kind === 'source' && file.tags.includes('svelte') && findScope(file.path, scopeEntries).path === scope,
    );
    return {
        compilerOptions: {
            ...TYPESCRIPT_DEFAULTS,
            ...options,
            typeRoots,
        },
        files: sources.map((file) => convertToPosixPath(relative(folder, join(root, file.path)))),
        ...(components.length === 0
            ? {}
            : { include: components.map((file) => convertToPosixPath(relative(folder, join(root, file.path)))) }),
    };
}

/**
 * Required compiler diagnostics and framework settings for generation and authored option auditing.
 *
 * @param level the selected check level.
 * @param selected the applicable configuration manifests.
 *
 * @returns the required compiler options.
 */
export function selectRequiredTsconfigOptions(level: Level, selected: Manifest[]): Record<string, boolean> {
    const options: Record<string, boolean> = { ...(level === 'all' ? COMPILER_OPTIONS : RECOMMENDED_OPTIONS) };
    if (selected.some((manifest) => manifest.configuration.name === NESTJS_CONFIGURATION))
        Object.assign(options, NESTJS_COMPILER_OPTIONS);
    return options;
}

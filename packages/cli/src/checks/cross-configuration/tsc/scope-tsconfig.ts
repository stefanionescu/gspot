import { join, dirname, relative } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { listIgnoredRules } from '#cli/settings/scopes.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import type { Level, Configuration } from '#cli/types/configurations.ts';
import { NESTJS_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import { TYPESCRIPT_TAG } from '#cli/config/checks/cross-configuration/tsc/compiler.ts';

import {
    COMPILER_OPTIONS,
    TYPESCRIPT_DEFAULTS,
    DEFAULT_LEVEL_OPTIONS,
    NESTJS_COMPILER_OPTIONS,
    TYPESCRIPT_TSCONFIG_CHECK,
} from '#cli/config/checks/cross-configuration/tsc/scope-tsconfig.ts';

/**
Builds the scope compiler configuration, extending its authored project when present.

@param session the repository and read cache.
@param scope the scope and settings.
@param file the absolute destination of the configuration.
@returns the compiler configuration.
*/
export function buildTsconfig(session: Session, scope: Scope, file: string): Record<string, unknown> {
    const ts = requireTypescript();
    const { root, toolsRoot, reads } = session;
    const ownFiles =
        Map.groupBy(session.repository.files, (file) =>
            selectScopePath(file.path, session.repository.scopeFolders),
        ).get(scope.path) ?? [];
    const scopeFiles = ownFiles.filter(
        (ownFile) =>
            ownFile.tags.includes(TYPESCRIPT_TAG) || DECLARATION_EXTENSIONS.includes(extractExtension(ownFile.path)),
    );
    const authored = readTsconfigProject(
        root,
        scope.path,
        scopeFiles.map((scopeFile) => scopeFile.path),
        reads,
    );
    const projectRoots =
        ts.getEffectiveTypeRoots(
            {},
            {
                getCurrentDirectory: () =>
                    join(toolsRoot, authored === undefined ? scope.path : relative(root, dirname(authored.path))),
            },
        ) ?? [];
    const folder = dirname(file);
    const typeRoots = projectRoots.map((path) => convertToPosixPath(relative(folder, path)));
    if (authored !== undefined)
        return {
            extends: convertToPosixPath(relative(folder, authored.path)),
            files: authored.config.fileNames.map((path) => convertToPosixPath(relative(folder, path))),
            compilerOptions: {
                ...(authored.config.options.typeRoots === undefined && { typeRoots }),
            },
        };
    const sources = scopeFiles.filter((scopeFile) => scopeFile.kind === 'source');
    const components = ownFiles.filter((ownFile) => ownFile.kind === 'source' && ownFile.tags.includes('svelte'));
    return {
        compilerOptions: {
            ...TYPESCRIPT_DEFAULTS,
            ...Object.fromEntries(
                Object.entries(selectRequiredTsconfigOptions(session.settings.level, scope.configurations)).filter(
                    ([name]) => !listIgnoredRules(scope, TYPESCRIPT_TSCONFIG_CHECK).includes(name),
                ),
            ),
            typeRoots,
        },
        files: sources.map((source) => convertToPosixPath(relative(folder, join(root, source.path)))),
        ...(components.length > 0 && {
            include: components.map((component) => convertToPosixPath(relative(folder, join(root, component.path)))),
        }),
    };
}

/**
Selects the compiler flags that the level and configurations require.

@param level the configured level.
@param configurations the configurations of the scope.
*/
export function selectRequiredTsconfigOptions(level: Level, configurations: Configuration[]): Record<string, boolean> {
    const options: Record<string, boolean> = { ...(level === 'all' ? COMPILER_OPTIONS : DEFAULT_LEVEL_OPTIONS) };
    if (configurations.some((configuration) => configuration.name === NESTJS_CONFIGURATION))
        Object.assign(options, NESTJS_COMPILER_OPTIONS);
    return options;
}

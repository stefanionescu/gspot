import ts from 'typescript';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Session } from '#cli/types/session.ts';
import { listIgnoredRules } from '#cli/settings/scopes.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import { join, dirname, resolve, relative } from 'node:path';
import type { PlannedTsconfig } from '#cli/types/checks/tsc.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import type { Level, Configuration } from '#cli/types/configurations.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';

import {
    COMPILER_OPTIONS,
    RECOMMENDED_OPTIONS,
    TYPESCRIPT_DEFAULTS,
    NESTJS_CONFIGURATION,
    NESTJS_COMPILER_OPTIONS,
    TYPESCRIPT_TSCONFIG_CHECK,
} from '#cli/config/checks/tsc/scope-tsconfig.ts';

function buildTsconfig(planned: PlannedTsconfig): Record<string, unknown> {
    const { root, typeRootsFolder, reads, target, scope, files, scopes, options } = planned;
    const authored = readTsconfigProject(
        root,
        scope,
        files
            .filter(
                (file) =>
                    (file.tags.includes('typescript') ||
                        DECLARATION_EXTENSIONS.includes(extractExtension(file.path))) &&
                    findScopeFolder(file.path, scopes).path === scope,
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
            (file.tags.includes('typescript') || DECLARATION_EXTENSIONS.includes(extractExtension(file.path))) &&
            findScopeFolder(file.path, scopes).path === scope,
    );
    const components = files.filter(
        (file) =>
            file.kind === 'source' && file.tags.includes('svelte') && findScopeFolder(file.path, scopes).path === scope,
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
 * Selects the compiler flags that the level and configurations require.
 *
 * @param level recommended or all.
 * @param configurations the configurations of the scope.
 * @returns the flags, by name.
 */
export function selectRequiredTsconfigOptions(level: Level, configurations: Configuration[]): Record<string, boolean> {
    const options: Record<string, boolean> = { ...(level === 'all' ? COMPILER_OPTIONS : RECOMMENDED_OPTIONS) };
    if (configurations.some((configuration) => configuration.name === NESTJS_CONFIGURATION))
        Object.assign(options, NESTJS_COMPILER_OPTIONS);
    return options;
}

/**
 * Drops the compiler flags that the scope turns off.
 *
 * @param level recommended or all.
 * @param scope the scope and its settings.
 * @returns the enabled compiler flags.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export function selectCheckedTsconfigOptions(level: Level, scope: Scope): Record<string, boolean> {
    return Object.fromEntries(
        Object.entries(selectRequiredTsconfigOptions(level, scope.configurations)).filter(
            ([name]) => !listIgnoredRules(scope, TYPESCRIPT_TSCONFIG_CHECK).includes(name),
        ),
    );
}

/**
 * Writes the tsconfig for a scope, which extends the tsconfig of the scope when it has one.
 *
 * @param session the repository and read cache.
 * @param scope where tsc runs, with its settings.
 * @param target where to write the tsconfig.
 * @returns the absolute path.
 */
export function writeScopeTsconfig(
    session: Pick<Session, 'root' | 'installedRoot' | 'reads' | 'settingsFile'> & {
        repository: Pick<Session['repository'], 'files' | 'scopeFolders'>;
    },
    scope: Scope,
    target: string,
): string {
    const input: PlannedTsconfig = {
        root: session.root,
        typeRootsFolder: session.installedRoot,
        reads: session.reads,
        target: convertToPosixPath(relative(session.root, target)),
        scope: scope.folder.path,
        files: session.repository.files,
        scopes: session.repository.scopeFolders,
        options: selectCheckedTsconfigOptions(session.settingsFile.settings.level, scope),
    };
    const file = join(input.root, input.target);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(buildTsconfig(input)));
    return file;
}

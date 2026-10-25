import ts from 'typescript';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { listIgnoredRules } from '#cli/settings/scopes.ts';
import { groupFilesByScope } from '#cli/repository/scopes.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { TYPESCRIPT_TAG } from '#cli/config/checks/tsc/compiler.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import type { Level, Configuration } from '#cli/types/configurations.ts';
import { NESTJS_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';

import {
    COMPILER_OPTIONS,
    RECOMMENDED_OPTIONS,
    TYPESCRIPT_DEFAULTS,
    NESTJS_COMPILER_OPTIONS,
    TYPESCRIPT_TSCONFIG_CHECK,
} from '#cli/config/checks/tsc/scope-tsconfig.ts';

function buildTsconfig(session: Session, scope: Scope, file: string): Record<string, unknown> {
    const { root, toolsRoot, reads } = session;
    const ownFiles = groupFilesByScope(session.repository.files, session.repository.scopeFolders).get(scope.path) ?? [];
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
            ...selectCheckedTsconfigOptions(session.settingsFile.settings.level, scope),
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

@param level recommended or all.
@param configurations the configurations of the scope.
@returns the flags, by name.
*/
export function selectRequiredTsconfigOptions(level: Level, configurations: Configuration[]): Record<string, boolean> {
    const options: Record<string, boolean> = { ...(level === 'all' ? COMPILER_OPTIONS : RECOMMENDED_OPTIONS) };
    if (configurations.some((configuration) => configuration.name === NESTJS_CONFIGURATION))
        Object.assign(options, NESTJS_COMPILER_OPTIONS);
    return options;
}

/**
Drops the compiler flags that the scope turns off.

@param level recommended or all.
@param scope the scope and its settings.
@returns the enabled compiler flags.
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
Writes the tsconfig for a scope, which extends the tsconfig of the scope when it has one.

@param session the repository and read cache.
@param scope where tsc runs, with its settings.
@param file the absolute path to write the tsconfig to.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export function writeScopeTsconfig(session: Session, scope: Scope, file: string): void {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(buildTsconfig(session, scope, file)));
}

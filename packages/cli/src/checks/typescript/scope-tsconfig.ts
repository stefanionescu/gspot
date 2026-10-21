import ts from 'typescript';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Session } from '#cli/types/session.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { readTsconfigProject } from '#cli/parsers/tsconfig.ts';
import { listIgnoredRules } from '#cli/settings/scope-view.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { NESTJS_CONFIGURATION } from '#cli/config/configurations.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import type { PlannedTsconfig } from '#cli/types/checks/typescript.ts';
import type { Level, Configuration } from '#cli/types/configurations.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';

import {
    COMPILER_OPTIONS,
    RECOMMENDED_OPTIONS,
    TYPESCRIPT_DEFAULTS,
    NESTJS_COMPILER_OPTIONS,
    TYPESCRIPT_TSCONFIG_CHECK,
} from '#cli/config/checks/typescript.ts';

/**
 * Builds a tsconfig that extends the authored one, or a standalone one when the scope has none.
 *
 * @param planned the scope and target path.
 * @returns the compiler settings to write as JSON.
 */
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
                    findScope(file.path, scopes).path === scope,
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
            findScope(file.path, scopes).path === scope,
    );
    // Svelte reads these extra extensions through include; tsc ignores them as unsupported sources.
    const components = files.filter(
        (file) => file.kind === 'source' && file.tags.includes('svelte') && findScope(file.path, scopes).path === scope,
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
 * @param selected the scope manifests.
 * @returns the flags, by name.
 */
export function selectRequiredTsconfigOptions(level: Level, selected: Configuration[]): Record<string, boolean> {
    const options: Record<string, boolean> = { ...(level === 'all' ? COMPILER_OPTIONS : RECOMMENDED_OPTIONS) };
    if (selected.some((configuration) => configuration.name === NESTJS_CONFIGURATION))
        Object.assign(options, NESTJS_COMPILER_OPTIONS);
    return options;
}

/**
 * Drops the compiler flags that the scope turns off.
 *
 * @param level recommended or all.
 * @param selection the scope and its settings.
 * @returns the enabled compiler flags.
 */
export function selectCheckedTsconfigOptions(level: Level, selection: Scope): Record<string, boolean> {
    return Object.fromEntries(
        Object.entries(selectRequiredTsconfigOptions(level, selection.selected)).filter(
            ([name]) => !listIgnoredRules(selection, TYPESCRIPT_TSCONFIG_CHECK).includes(name),
        ),
    );
}

/**
 * Writes the tsconfig for a scope, extending its authored tsconfig.
 *
 * @param session the repository and read cache.
 * @param selection where tsc runs, with its settings.
 * @param target where to write the tsconfig.
 * @returns the absolute path.
 */
export function writeScopeTsconfig(
    session: Pick<Session, 'root' | 'installedRoot' | 'reads' | 'settingsFile'> & {
        repository: Pick<Session['repository'], 'files' | 'scopeFolders'>;
    },
    selection: Scope,
    target: string,
): string {
    const input: PlannedTsconfig = {
        root: session.root,
        typeRootsFolder: session.installedRoot,
        reads: session.reads,
        target: convertToPosixPath(relative(session.root, target)),
        scope: selection.scope.path,
        files: session.repository.files,
        scopes: session.repository.scopeFolders,
        options: selectCheckedTsconfigOptions(session.settingsFile.settings.level, selection),
    };
    const file = join(input.root, input.target);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(buildTsconfig(input)));
    return file;
}

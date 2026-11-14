import type { Session } from '#cli/types/tools.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { listOwnFiles } from '#cli/repository/scopes.ts';
import { listIgnoredRules } from '#cli/settings/tables.ts';
import type { Level, Scope } from '#cli/types/settings.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system.ts';
import type { TypeScriptProject } from '#cli/types/parsers.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import { requireTypescript } from '#cli/system/package/typescript.ts';
import { NESTJS_CONFIGURATION } from '#cli/config/settings/detected.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';

import {
    TYPESCRIPT_TAG,
    COMPILER_OPTIONS,
    TYPESCRIPT_DEFAULTS,
    TSCONFIG_COPY_FOLDER,
    DEFAULT_LEVEL_OPTIONS,
    NESTJS_COMPILER_OPTIONS,
    TYPESCRIPT_TSCONFIG_CHECK,
} from '#cli/config/configurations/shared.ts';

function buildTsconfig(session: Session, scope: Scope, file: string): Record<string, unknown> {
    const ts = requireTypescript();
    const { root, toolsRoot, cache } = session;
    const ownFiles = listOwnFiles(session.repository.files, session.repository.scopeFolders, scope.path);
    const scopeFiles = ownFiles.filter(
        (ownFile) =>
            ownFile.tags.includes(TYPESCRIPT_TAG) || DECLARATION_EXTENSIONS.includes(extractExtension(ownFile.path)),
    );
    const authored = readTsconfigProject(
        root,
        scope.path,
        scopeFiles.map((scopeFile) => scopeFile.path),
        cache,
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
    if (authored !== undefined) {
        const { files, types } = readAuthoredTypes(authored, folder);
        return {
            extends: convertToPosixPath(relative(folder, authored.path)),
            files: [...authored.config.fileNames.map((path) => convertToPosixPath(relative(folder, path))), ...files],
            compilerOptions: {
                ...(authored.config.options.typeRoots === undefined && { typeRoots }),
                ...(types !== undefined && { types }),
            },
        };
    }
    const sources = scopeFiles.filter((scopeFile) => scopeFile.kind === 'source');
    const components = ownFiles.filter((ownFile) => ownFile.kind === 'source' && ownFile.tags.includes('svelte'));
    return {
        compilerOptions: {
            ...TYPESCRIPT_DEFAULTS,
            ...listEnforcedTsconfigOptions(session.settings.level, scope),
            typeRoots,
        },
        files: sources.map((source) => convertToPosixPath(relative(folder, join(root, source.path)))),
        ...(components.length > 0 && {
            include: components.map((component) => convertToPosixPath(relative(folder, join(root, component.path)))),
        }),
    };
}

/**
Resolve each `types` entry from the folder of the authored project, because TypeScript looks from the generated
config, and the packages that the project installed are out of reach from there.
*/
export function readAuthoredTypes(
    authored: Pick<TypeScriptProject, 'path' | 'config'>,
    folder: string,
): { files: string[]; types?: string[] } {
    const ts = requireTypescript();
    const { options } = authored.config;
    if (options.types === undefined) return { files: [] };
    const found = options.types.map((entry) => {
        const lookup = ts.resolveTypeReferenceDirective(entry, authored.path, options, ts.sys);
        return { entry, path: lookup.resolvedTypeReferenceDirective?.resolvedFileName };
    });
    return {
        files: found.flatMap(({ path }) => (path === undefined ? [] : [convertToPosixPath(relative(folder, path))])),
        types: found.filter(({ path }) => path === undefined).map(({ entry }) => entry),
    };
}

export function selectRequiredTsconfigOptions(level: Level, configurations: Configuration[]): Record<string, boolean> {
    const options: Record<string, boolean> = { ...(level === 'all' ? COMPILER_OPTIONS : DEFAULT_LEVEL_OPTIONS) };
    if (configurations.some((configuration) => configuration.name === NESTJS_CONFIGURATION))
        Object.assign(options, NESTJS_COMPILER_OPTIONS);
    return options;
}

export function listEnforcedTsconfigOptions(level: Level, scope: Scope): Record<string, boolean> {
    const ignored = listIgnoredRules(scope, TYPESCRIPT_TSCONFIG_CHECK);
    return Object.fromEntries(
        Object.entries(selectRequiredTsconfigOptions(level, scope.configurations)).filter(
            ([name]) => !ignored.includes(name),
        ),
    );
}

/**
Write the tsconfig of a scope below `folder`.

@returns the path of the written file.
*/
export function writeScopeTsconfig(session: Session, scope: Scope, folder: string): string {
    const path = join(folder, TSCONFIG_COPY_FOLDER, scope.path, TSCONFIG_FILE);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(buildTsconfig(session, scope, path)));
    return path;
}

import { dirname, join, relative } from 'node:path';

import { TYPESCRIPT_TAG } from '#cli/config/configurations/framework.ts';
import {
    COMPILER_OPTIONS,
    DEFAULT_LEVEL_OPTIONS,
    NESTJS_COMPILER_OPTIONS,
    NESTJS_CONFIGURATION,
    TYPESCRIPT_DEFAULTS,
    TYPESCRIPT_TSCONFIG_CHECK,
} from '#cli/config/configurations/registry.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system.ts';
import { readTsconfigProject } from '#cli/parsers/projects/tsconfig.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { listIgnoredRules } from '#cli/settings/scopes.ts';
import { convertToPosixPath, extractExtension } from '#cli/system/paths.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { TypeScriptProject } from '#cli/types/parsers.ts';
import type { Level, Scope } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';

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

export function buildTsconfig(session: Session, scope: Scope, file: string): Record<string, unknown> {
    const ts = requireTypescript();
    const { root, toolsRoot, cache } = session;
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

export function selectRequiredTsconfigOptions(level: Level, configurations: Configuration[]): Record<string, boolean> {
    const options: Record<string, boolean> = { ...(level === 'all' ? COMPILER_OPTIONS : DEFAULT_LEVEL_OPTIONS) };
    if (configurations.some((configuration) => configuration.name === NESTJS_CONFIGURATION))
        Object.assign(options, NESTJS_COMPILER_OPTIONS);
    return options;
}

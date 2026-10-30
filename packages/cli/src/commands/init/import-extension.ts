import { join } from 'node:path';
import { setKey } from '#cli/settings/edit.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { createRunCache } from '#cli/system/cache.ts';
import type { RunCache } from '#cli/types/system/cache.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import type { ScopeConfigurations } from '#cli/types/commands/init.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects/tsconfig.ts';
import type { ImportExtensionStyle } from '#cli/types/settings/tools.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/manifests/names.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { BUNDLER_PACKAGES, IMPORT_EXTENSION_SETTING } from '#cli/config/commands/init/import-extension.ts';

function detectImportExtension(
    repository: Repository,
    scopePath: string,
    cache: RunCache,
): ImportExtensionStyle | undefined {
    const ts = requireTypescript();
    const path = join(repository.root, joinScope(scopePath, TSCONFIG_FILE));
    const options = readTsconfig(repository.root, path, cache)?.options;
    if (
        options !== undefined &&
        (options.allowImportingTsExtensions === true || options.rewriteRelativeImportExtensions === true)
    )
        return 'ts';
    return options?.moduleResolution === ts.ModuleResolutionKind.Bundler ||
        listProjectDependencyNames(repository.dependencyFiles, scopePath).some((name) => BUNDLER_PACKAGES.has(name))
        ? 'extensionless'
        : undefined;
}

/**
Choose the import extension style of each JavaScript scope that no framework configuration chooses.

@param scopes each scope with its selected configurations.
@param repository the tracked files and dependency files.
@returns the settings table to write for each scope that needs a style other than the default.
*/
export function buildImportExtensionTables(
    scopes: ScopeConfigurations[],
    repository: Repository,
): Map<string, TomlTable> {
    const cache = createRunCache(repository.root);
    return new Map(
        scopes.flatMap(({ scope, selected: configurations }): [string, TomlTable][] => {
            if (
                configurations.every((configuration) => configuration.name !== JAVASCRIPT_CONFIGURATION) ||
                configurations.some((configuration) => Object.hasOwn(configuration.defaults, IMPORT_EXTENSION_SETTING))
            )
                return [];
            const style = detectImportExtension(repository, scope, cache);
            if (style === undefined) return [];
            const table: TomlTable = {};
            setKey(table, IMPORT_EXTENSION_SETTING, style);
            return [[scope, table]];
        }),
    );
}

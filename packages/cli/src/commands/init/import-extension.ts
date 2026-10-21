import ts from 'typescript';
import { join } from 'node:path';
import { setKey } from '#cli/settings/edit.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { readTsconfig } from '#cli/parsers/tsconfig.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import type { IMPORT_EXTENSION_STYLES } from '#cli/config/settings/schema.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import { BUNDLER_PACKAGES, IMPORT_EXTENSION_SETTING } from '#cli/config/commands/init.ts';

function detectImportExtension(
    repository: Repository,
    scope: string,
    reads: ReadCache,
): (typeof IMPORT_EXTENSION_STYLES)[number] | undefined {
    const path = join(repository.root, joinScope(scope, TSCONFIG_FILE));
    const options = readTsconfig(repository.root, path, reads)?.options;
    if (
        options !== undefined &&
        (options.allowImportingTsExtensions === true || options.rewriteRelativeImportExtensions === true)
    )
        return 'ts';
    return options?.moduleResolution === ts.ModuleResolutionKind.Bundler ||
        listProjectDependencyNames(repository.dependencyFiles, scope).some((name) => BUNDLER_PACKAGES.has(name))
        ? 'extensionless'
        : undefined;
}

/**
 * Choose the import suffix style of each JavaScript scope that no framework configuration chooses.
 *
 * @param scopes each scope with its selected configurations.
 * @param repository the tracked files and dependency declarations.
 * @returns the settings table to write for each scope that needs a style other than the default.
 */
export function buildImportExtensionTables(
    scopes: { scope: string; selected: Configuration[] }[],
    repository: Repository,
): Map<string, TomlTable> {
    const reads = createReadCache(repository.root);
    return new Map(
        scopes.flatMap(({ scope, selected: configurations }): [string, TomlTable][] => {
            if (!configurations.some((configuration) => configuration.name === JAVASCRIPT_CONFIGURATION)) return [];
            if (configurations.some((configuration) => Object.hasOwn(configuration.defaults, IMPORT_EXTENSION_SETTING)))
                return [];
            const style = detectImportExtension(repository, scope, reads);
            if (style === undefined) return [];
            const table: TomlTable = {};
            setKey(table, IMPORT_EXTENSION_SETTING, style);
            return [[scope, table]];
        }),
    );
}

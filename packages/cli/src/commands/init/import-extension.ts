import { join } from 'node:path';
import type ts from 'typescript';
import { setKey } from '#cli/settings/edit.ts';
import type { RunCache } from '#cli/types/system.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { Repository } from '#cli/types/repository.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/blocks.ts';
import { BUNDLER_PACKAGES, IMPORT_EXTENSION_SETTING } from '#cli/config/commands/edits.ts';
import type { ScopeConfigurations, ImportExtensionStyle } from '#cli/types/commands/edits.ts';

function detectCompilerStyle(options: ts.CompilerOptions): ImportExtensionStyle | undefined {
    const { ModuleKind, ModuleResolutionKind } = requireTypescript();
    if (options.allowImportingTsExtensions === true || options.rewriteRelativeImportExtensions === true) return 'ts';
    if (options.module === ModuleKind.NodeNext || options.moduleResolution === ModuleResolutionKind.NodeNext)
        return 'js';
    return options.moduleResolution === ModuleResolutionKind.Bundler ? 'extensionless' : undefined;
}

function detectImportExtension(
    repository: Repository,
    scopePath: string,
    cache: RunCache,
): ImportExtensionStyle | undefined {
    const path = join(repository.root, joinScope(scopePath, TSCONFIG_FILE));
    const options = readTsconfig(repository.root, path, cache)?.options;
    const compilerStyle = options === undefined ? undefined : detectCompilerStyle(options);
    if (compilerStyle !== undefined) return compilerStyle;
    return listProjectDependencyNames(repository.dependencyFiles, scopePath).some((name) => BUNDLER_PACKAGES.has(name))
        ? 'extensionless'
        : undefined;
}

/**
Choose the import extension style of each JavaScript scope. A framework's default stands unless the tsconfig uses nodenext.

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
            if (configurations.every((configuration) => configuration.name !== JAVASCRIPT_CONFIGURATION)) return [];
            const style = detectImportExtension(repository, scope, cache);
            const hasFrameworkStyle = configurations.some((configuration) =>
                Object.hasOwn(configuration.defaults, IMPORT_EXTENSION_SETTING),
            );
            if (style === undefined || (hasFrameworkStyle && style !== 'js')) return [];
            const table: TomlTable = {};
            setKey(table, IMPORT_EXTENSION_SETTING, style);
            return [[scope, table]];
        }),
    );
}

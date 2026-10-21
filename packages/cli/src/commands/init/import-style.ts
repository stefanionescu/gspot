import ts from 'typescript';
import { join } from 'node:path';
import { setKey } from '#cli/settings/edit.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { readTsconfig } from '#cli/parsers/tsconfig.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import type { IMPORT_EXTENSION_STYLES } from '#cli/config/settings/schema.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import { BUNDLER_PACKAGES, IMPORT_STYLE_SETTING } from '#cli/config/commands/init.ts';

function importsTypeScriptFiles(options: ts.CompilerOptions): boolean {
    return options.allowImportingTsExtensions === true || options.rewriteRelativeImportExtensions === true;
}

function isBundled(options: ts.CompilerOptions | undefined, repository: Repository, scope: string): boolean {
    return (
        options?.moduleResolution === ts.ModuleResolutionKind.Bundler ||
        listProjectDependencyNames(repository.dependencyFiles, scope).some((name) => BUNDLER_PACKAGES.has(name))
    );
}

function detectImportStyle(
    repository: Repository,
    scope: string,
    reads: ReadCache,
): (typeof IMPORT_EXTENSION_STYLES)[number] | undefined {
    const path = join(repository.root, joinScope(scope, TSCONFIG_FILE));
    const options = readTsconfig(repository.root, path, reads)?.options;
    if (options !== undefined && importsTypeScriptFiles(options)) return 'ts';
    return isBundled(options, repository, scope) ? 'extensionless' : undefined;
}

/**
 * Choose the import suffix style of each JavaScript scope that no framework configuration chooses.
 *
 * @param selections each scope with its selected configurations.
 * @param repository the tracked files and dependency declarations.
 * @returns the settings table to write for each scope that needs a style other than the default.
 */
export function buildImportStyleTables(
    selections: { scope: string; selected: Manifest[] }[],
    repository: Repository,
): Map<string, TomlTable> {
    const reads = createReadCache(repository.root);
    return new Map(
        selections.flatMap(({ scope, selected }): [string, TomlTable][] => {
            if (!selected.some((manifest) => manifest.configuration.name === JAVASCRIPT_CONFIGURATION)) return [];
            if (selected.some((manifest) => Object.hasOwn(manifest.defaults, IMPORT_STYLE_SETTING))) return [];
            const style = detectImportStyle(repository, scope, reads);
            if (style === undefined) return [];
            const table: TomlTable = {};
            setKey(table, IMPORT_STYLE_SETTING, style);
            return [[scope, table]];
        }),
    );
}

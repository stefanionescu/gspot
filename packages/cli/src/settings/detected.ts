import type ts from 'typescript';
import { join, posix } from 'node:path';
import { setKey } from '#cli/settings/edit.ts';
import { isInScope } from '#cli/system/paths.ts';
import type { RunCache } from '#cli/types/system.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { findText } from '#cli/system/files/reads.ts';
import type { Repository } from '#cli/types/repository.ts';
import { requireTypescript } from '#cli/system/typescript.ts';
import { buildFilenameMatcher } from '#cli/system/matchers.ts';
import { findTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { parseBuildSettings } from '#cli/parsers/projects/xcode.ts';
import { TSCONFIG_FILE, PBXPROJ_SUFFIX } from '#cli/config/parsers.ts';
import { joinScope, selectScopePath } from '#cli/repository/scopes.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { detectPackageManager } from '#cli/repository/javascript/package-manager.ts';
import type { TomlTable, DetectedScopes, ScopeConfigurations, ImportExtensionStyle } from '#cli/types/settings.ts';

import {
    BUILD_SCRIPT,
    MESSAGES_FOLDER,
    OPENNEXT_PACKAGE,
    BUNDLER_PACKAGES,
    XCODE_DESTINATIONS,
    SITE_CONFIGURATION,
    SWIFT_CONFIGURATION,
    MESSAGES_FILE_SUFFIX,
    OPENAPI_CONFIGURATION,
    OPENNEXT_TYPE_DEFAULTS,
    CLOUDFLARE_CONFIGURATION,
    IMPORT_EXTENSION_SETTING,
    JAVASCRIPT_CONFIGURATION,
    TRANSLATIONS_CONFIGURATION,
} from '#cli/config/settings/detected.ts';

const TS_SUFFIX_IMPORT = /(?:\bfrom|\bimport)\s*(?:\(\s*)?["']\.{1,2}\/[^"']*\.[cm]?tsx?["']/u;

function buildOpenApiTable(selection: ScopeConfigurations, { repository, scopes }: DetectedScopes): TomlTable {
    const openapi = selection.selected.find((configuration) => configuration.name === OPENAPI_CONFIGURATION);
    if (openapi === undefined) return {};
    const isDocument = buildFilenameMatcher(openapi.detect.filenames);
    const document = repository.files.find(
        (file) => selectScopePath(file.path, scopes) === selection.scopePath && isDocument(file.path),
    )?.path;
    return document === undefined ? {} : { openapi: { document } };
}

function buildSwiftTable(selection: ScopeConfigurations, { repository, scopes }: DetectedScopes): TomlTable {
    if (selection.selected.every(({ name }) => name !== SWIFT_CONFIGURATION)) return {};
    const file = repository.files.find(
        ({ path }) => path.endsWith(PBXPROJ_SUFFIX) && selectScopePath(path, scopes) === selection.scopePath,
    )?.path;
    if (file === undefined) return {};
    const text = findText(repository.root, file);
    const sdkRoot = text === undefined ? undefined : parseBuildSettings(text, file).sdkRoot;
    const destination = XCODE_DESTINATIONS.get(sdkRoot);
    return {
        swift: {
            xcode_project: posix.dirname(file),
            ...(destination !== undefined && { xcode_destination: destination }),
        },
    };
}

function buildSiteTable(selection: ScopeConfigurations, { repository }: DetectedScopes): TomlTable {
    if (selection.selected.every(({ name }) => name !== SITE_CONFIGURATION)) return {};
    const sources = repository.files.filter((file) => file.kind === 'source').map((file) => file.path);
    const { name } = detectPackageManager(repository.root, sources);
    return { site: { build_command: [name, ...BUILD_SCRIPT] } };
}

function buildCloudflareTable(selection: ScopeConfigurations, { repository }: DetectedScopes): TomlTable {
    if (selection.selected.every(({ name }) => name !== CLOUDFLARE_CONFIGURATION)) return {};
    const dependencies = listProjectDependencyNames(repository.dependencyFiles, selection.scopePath);
    return dependencies.includes(OPENNEXT_PACKAGE) ? { cloudflare: { ...OPENNEXT_TYPE_DEFAULTS } } : {};
}

function buildTranslationsTable(selection: ScopeConfigurations, { repository }: DetectedScopes): TomlTable {
    if (selection.selected.every(({ name }) => name !== TRANSLATIONS_CONFIGURATION)) return {};
    const folder = joinScope(selection.scopePath, MESSAGES_FOLDER);
    const hasMessages = repository.files.some(
        ({ path }) => path.startsWith(`${folder}/`) && path.endsWith(MESSAGES_FILE_SUFFIX),
    );
    return hasMessages ? { translations: { messages_folder: folder } } : {};
}

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
    const options = findTsconfig(repository.root, path, cache)?.options;
    const compilerStyle = options === undefined ? undefined : detectCompilerStyle(options);
    if (compilerStyle !== undefined) return compilerStyle;
    return listProjectDependencyNames(repository.dependencyFiles, scopePath).some((name) => BUNDLER_PACKAGES.has(name))
        ? 'extensionless'
        : undefined;
}

function hasTsImports(repository: Repository, scopePath: string, cache: RunCache): boolean {
    const extensions = listTaggedExtensions('typescript');
    return repository.files.some(
        (file) =>
            file.kind === 'source' &&
            isInScope(file.path, scopePath) &&
            extensions.includes(posix.extname(file.path)) &&
            TS_SUFFIX_IMPORT.test(findText(cache, file.path) ?? ''),
    );
}

function buildImportExtensionTable(selection: ScopeConfigurations, repository: Repository, cache: RunCache): TomlTable {
    if (selection.selected.every(({ name }) => name !== JAVASCRIPT_CONFIGURATION)) return {};
    const style = detectImportExtension(repository, selection.scopePath, cache);
    if (style === undefined) return {};
    const hasFrameworkStyle = selection.selected.some((configuration) =>
        Object.hasOwn(configuration.defaults, IMPORT_EXTENSION_SETTING),
    );
    const isSuffixRequired = style === 'js' || (style === 'ts' && hasTsImports(repository, selection.scopePath, cache));
    if (hasFrameworkStyle && !isSuffixRequired) return {};
    const table: TomlTable = {};
    setKey(table, IMPORT_EXTENSION_SETTING, style);
    return table;
}

/**
Build the values that the repository gives for the selected configurations of each scope.

@param selections each scope with the configurations to detect values for.
@param detected the repository and the scope folders that hold its files.
@returns the settings table of each scope.
*/
export function buildDetectedTables(
    selections: ScopeConfigurations[],
    detected: DetectedScopes,
): Map<string, TomlTable> {
    const cache = createRunCache(detected.repository.root);
    return new Map(
        selections.map((selection) => [
            selection.scopePath,
            {
                ...buildSwiftTable(selection, detected),
                ...buildOpenApiTable(selection, detected),
                ...buildSiteTable(selection, detected),
                ...buildCloudflareTable(selection, detected),
                ...buildTranslationsTable(selection, detected),
                ...buildImportExtensionTable(selection, detected.repository, cache),
            },
        ]),
    );
}

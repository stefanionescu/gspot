import { join, posix } from 'node:path';

import type ts from 'typescript';

import { PBXPROJ_SUFFIX, TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import {
    BUNDLER_PACKAGES,
    CLOUDFLARE_CONFIGURATION,
    IMPORT_EXTENSION_SETTING,
    JAVASCRIPT_CONFIGURATION,
    MESSAGE_FILE_SUFFIX,
    MESSAGES_FOLDER,
    OPENAPI_CONFIGURATION,
    OPENNEXT_PACKAGE,
    OPENNEXT_TYPE_DEFAULTS,
    SWIFT_CONFIGURATION,
    TRANSLATIONS_CONFIGURATION,
    TS_SUFFIX_IMPORT,
    XCODE_DESTINATIONS,
} from '#cli/config/settings/detected.ts';
import { findTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { parseBuildSettings } from '#cli/parsers/projects/xcode/targets.ts';
import { listTaggedExtensions } from '#cli/repository/files/tags.ts';
import { listProjectDependencyNames } from '#cli/repository/projects/dependencies.ts';
import { isInScope, joinScope, listOwnFiles } from '#cli/repository/scopes.ts';
import { setKey } from '#cli/settings/toml/edit.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { findText, readText } from '#cli/system/files/reads.ts';
import { requireTypescript } from '#cli/system/package/typescript.ts';
import { buildFilenameMatcher } from '#cli/system/patterns.ts';
import type { Repository } from '#cli/types/repository.ts';
import type { DetectedScopes, ImportExtensionStyle, ScopeConfigurations, TomlTable } from '#cli/types/settings.ts';
import type { RunCache } from '#cli/types/system.ts';

function buildOpenApiTable(selection: ScopeConfigurations, { repository, scopes }: DetectedScopes): TomlTable {
    const openapi = selection.selected.find((configuration) => configuration.name === OPENAPI_CONFIGURATION);
    if (openapi === undefined) return {};
    const isDocument = buildFilenameMatcher(openapi.detect.filenames);
    const document = listOwnFiles(repository.files, scopes, selection.scopePath).find((file) =>
        isDocument(file.path),
    )?.path;
    return document === undefined ? {} : { openapi: { document } };
}

function buildSwiftTable(selection: ScopeConfigurations, { repository, scopes }: DetectedScopes): TomlTable {
    if (selection.selected.every(({ name }) => name !== SWIFT_CONFIGURATION)) return {};
    const file = listOwnFiles(repository.files, scopes, selection.scopePath).find(({ path }) =>
        path.endsWith(PBXPROJ_SUFFIX),
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

function buildCloudflareTable(selection: ScopeConfigurations, { repository }: DetectedScopes): TomlTable {
    if (selection.selected.every(({ name }) => name !== CLOUDFLARE_CONFIGURATION)) return {};
    const dependencies = listProjectDependencyNames(repository.dependencyFiles, selection.scopePath);
    return dependencies.includes(OPENNEXT_PACKAGE) ? { cloudflare: { ...OPENNEXT_TYPE_DEFAULTS } } : {};
}

function buildTranslationsTable(selection: ScopeConfigurations, { repository }: DetectedScopes): TomlTable {
    if (selection.selected.every(({ name }) => name !== TRANSLATIONS_CONFIGURATION)) return {};
    const folder = joinScope(selection.scopePath, MESSAGES_FOLDER);
    const hasMessages = repository.files.some(
        ({ path }) => path.startsWith(`${folder}/`) && path.endsWith(MESSAGE_FILE_SUFFIX),
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
            TS_SUFFIX_IMPORT.test(readText(cache, file.path)),
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
                ...buildCloudflareTable(selection, detected),
                ...buildTranslationsTable(selection, detected),
                ...buildImportExtensionTable(selection, detected.repository, cache),
            },
        ]),
    );
}

import picomatch from 'picomatch';
import { escapeGlob } from '#cli/system/paths.ts';
import type { Scope } from '#cli/types/settings.ts';
import { FOLDER_CONTENTS } from '#cli/config/system.ts';
import { joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { readScopeAliases, readPackageAliases } from '#cli/repository/javascript/aliases.ts';
import type { EslintBlock, PlannedEslintFile, EslintImportBoundaryRule } from '#cli/types/configurations/language.ts';

import {
    buildNodePatterns,
    buildExtensionGlob,
    buildScopeOverrideBlocks,
} from '#cli/configurations/language/javascript/eslint/files.ts';
import {
    REGEX_SYMBOLS,
    CODE_LANGUAGES,
    ANY_DEPTH_PREFIX,
    IMPORT_EXTENSIONS,
    EXTENSIONLESS_CODE,
    FILE_EXTENSION_RULE,
    NODE_SCRIPT_PATTERNS,
    DENO_IMPORT_EXTENSION,
    PATH_SEPARATOR_PATTERN,
    IMPORT_BOUNDARIES_RULE,
    IMPORT_BOUNDARY_FOLDERS,
    TYPESCRIPT_EXTENSION_MAP,
} from '#cli/config/configurations/blocks.ts';

/**
Build the n/file-extension-in-import blocks for each project and path style.

@param scopes the projects and their import styles.
@param nodeFiles your own scripts that run on Node.js.
@param denoFolders the folders that hold a Deno config file, whose code imports the real `.ts` extension.
*/
export function buildImportStyleBlocks(scopes: Scope[], nodeFiles: string[], denoFolders: Set<string>): EslintBlock[] {
    return buildScopeOverrideBlocks(scopes, {
        read: ({ path, settings }) =>
            denoFolders.has(path) ? DENO_IMPORT_EXTENSION : settings.tables.javascript?.import_extension,
        build: ({ scope: { path }, value, ignores }) =>
            value === undefined
                ? []
                : [
                      {
                          files: [buildExtensionGlob(...CODE_LANGUAGES), ...buildNodePatterns(nodeFiles, path)].map(
                              (pattern) => [joinScope(escapeGlob(path), '**/*'), pattern],
                          ),
                          ignores,
                          settings: {
                              n: {
                                  tryExtensions: IMPORT_EXTENSIONS,
                                  typescriptExtensionMap: value === 'js' ? TYPESCRIPT_EXTENSION_MAP : [],
                              },
                          },
                          rules: {
                              [FILE_EXTENSION_RULE]:
                                  value === 'extensionless'
                                      ? ['error', 'always', EXTENSIONLESS_CODE]
                                      : ['error', 'always'],
                          },
                      },
                  ],
    });
}

/**
List the folders that relative imports may not leave: the shipped folders, the projects, and your boundaries.

@param scopes the projects and their settings.
*/
export function listImportBoundaryFolders(scopes: Scope[]): string[] {
    const scopePaths = scopes.map((scope) => escapeGlob(scope.path)).filter((path) => path !== '');
    const boundaries = scopes.flatMap(({ settings }) => settings.tables.javascript?.import_boundaries ?? []);
    return [...new Set([...IMPORT_BOUNDARY_FOLDERS, ...scopePaths, ...boundaries])];
}

/**
Build one relative-import boundary rule from the project folders and aliases. The root and nested rules share the
boundary folders and the aliases of their project.

@param scopes the projects and their settings.
@param aliases the repository-relative alias paths.
*/
export function buildImportBoundariesRule(scopes: Scope[], aliases: Record<string, string>): EslintImportBoundaryRule {
    const externals = [...new Set(scopes.flatMap(({ settings }) => settings.tables.javascript?.externals ?? []))];
    return [
        'error',
        {
            folders: listImportBoundaryFolders(scopes),
            aliases,
            ...(externals.length > 0 && { externals }),
        },
    ];
}

/**
Resolve nested project boundaries against the aliases of each project.

@param planned the scopes and Node.js script paths to cover.
*/
export function buildScopeImportBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintBlock[] {
    const {
        session: { root, cache, scopes },
        nodeFiles,
    } = planned;
    return scopes
        .filter((scope) => scope.path !== '')
        .map((scope) => {
            const path = scope.path;
            const aliases = readScopeAliases(root, path, cache);
            return {
                files: [
                    joinScope(escapeGlob(path), buildExtensionGlob(...CODE_LANGUAGES)),
                    ...buildNodePatterns(nodeFiles, path),
                ],
                rules: {
                    [IMPORT_BOUNDARIES_RULE]: buildImportBoundariesRule(scopes, aliases),
                },
            };
        });
}

/**
Keep the imports of Node scripts runnable: Node needs full file names, and resolves only package.json imports.
These blocks come after the style and project blocks, so they win for .mjs, .cjs, and Node shebang files.

@param planned the scopes and the Node scripts without a code extension.
@returns one block for each project.
*/
export function buildNodeScriptBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintBlock[] {
    const {
        session: { root, scopes },
        nodeFiles,
    } = planned;
    const paths = scopes.map((scope) => scope.path);
    return scopes.map((scope) => {
        const path = scope.path;
        return {
            files: [
                ...NODE_SCRIPT_PATTERNS.map((pattern) => joinScope(escapeGlob(path), pattern)),
                ...buildNodePatterns(nodeFiles, path),
            ],
            ignores: listNestedScopes(paths, path).map((path) => joinScope(escapeGlob(path), '**')),
            settings: { n: { tryExtensions: IMPORT_EXTENSIONS, typescriptExtensionMap: [] } },
            rules: {
                [FILE_EXTENSION_RULE]: ['error', 'always'],
                [IMPORT_BOUNDARIES_RULE]: buildImportBoundariesRule(
                    scopes,
                    readPackageAliases(root, joinScope(path, '')),
                ),
            },
        };
    });
}

/**
Turn the ignored folder globs into the patterns that import-x/ignore matches against resolved module paths, so the
import rules never parse a gitignored bundle or build output.

@param globs the ignore globs of the ESLint file.
@returns a pattern for each ignored folder without other wildcards.
*/
export function buildImportIgnores(globs: string[]): string[] {
    const patterns: string[] = [];
    for (const glob of globs) {
        if (glob.startsWith('!') || !glob.endsWith(FOLDER_CONTENTS)) continue;
        const folder = glob.slice(0, -FOLDER_CONTENTS.length).replace(ANY_DEPTH_PREFIX, '');
        if (folder === '' || picomatch.scan(folder).isGlob) continue;
        const escaped = folder
            .replaceAll(REGEX_SYMBOLS, (symbol) => '\\' + symbol)
            .replaceAll('/', () => PATH_SEPARATOR_PATTERN);
        patterns.push(`${PATH_SEPARATOR_PATTERN}${escaped}${PATH_SEPARATOR_PATTERN}`);
    }
    return patterns;
}

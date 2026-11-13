import picomatch from 'picomatch';

import {
    ANY_DEPTH_PREFIX,
    CODE_LANGUAGES,
    DENO_IMPORT_EXTENSION,
    EXTENSIONLESS_CODE,
    FILE_EXTENSION_RULE,
    IMPORT_BOUNDARIES_RULE,
    IMPORT_BOUNDARY_FOLDERS,
    IMPORT_EXTENSIONS,
    NODE_SCRIPT_PATTERNS,
    TYPESCRIPT_EXTENSION_MAP,
} from '#cli/config/configurations/javascript/eslint-blocks.ts';
import { PATH_SEPARATOR_PATTERN } from '#cli/config/configurations/language.ts';
import { FOLDER_CONTENTS } from '#cli/config/system.ts';
import { readPackageAliases, readScopeAliases } from '#cli/configurations/language/javascript/aliases.ts';
import {
    buildExtensionGlob,
    buildNodePatterns,
    buildScopeOverrideBlocks,
    listNestedScopeGlobs,
} from '#cli/configurations/language/javascript/eslint/files.ts';
import { joinScope, joinScopeGlob } from '#cli/repository/scopes.ts';
import { escapeGlob, escapeRegExp } from '#cli/system/patterns.ts';
import type { EslintBlock, EslintImportBoundaryRule, PlannedEslintFile } from '#cli/types/configurations/javascript.ts';
import type { Scope } from '#cli/types/settings.ts';

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
                              (pattern) => [joinScopeGlob(path, '**/*'), pattern],
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

export function listImportBoundaryFolders(scopes: Scope[]): string[] {
    const scopePaths = scopes.map((scope) => escapeGlob(scope.path)).filter((path) => path !== '');
    const boundaries = scopes.flatMap(({ settings }) => settings.tables.javascript?.import_boundaries ?? []);
    return [...new Set([...IMPORT_BOUNDARY_FOLDERS, ...scopePaths, ...boundaries])];
}

export function listExternals(scopes: Scope[]): string[] {
    return [...new Set(scopes.flatMap(({ settings }) => settings.tables.javascript?.externals ?? []))];
}

export function buildImportBoundariesRule(scopes: Scope[], aliases: Record<string, string>): EslintImportBoundaryRule {
    const externals = listExternals(scopes);
    return [
        'error',
        {
            folders: listImportBoundaryFolders(scopes),
            aliases,
            ...(externals.length > 0 && { externals }),
        },
    ];
}

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
                    joinScopeGlob(path, buildExtensionGlob(...CODE_LANGUAGES)),
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
                ...NODE_SCRIPT_PATTERNS.map((pattern) => joinScopeGlob(path, pattern)),
                ...buildNodePatterns(nodeFiles, path),
            ],
            ignores: listNestedScopeGlobs(paths, path),
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
*/
export function buildImportIgnores(globs: string[]): string[] {
    const patterns: string[] = [];
    for (const glob of globs) {
        if (glob.startsWith('!') || !glob.endsWith(FOLDER_CONTENTS)) continue;
        const folder = glob.slice(0, -FOLDER_CONTENTS.length).replace(ANY_DEPTH_PREFIX, '');
        if (folder === '' || picomatch.scan(folder).isGlob) continue;
        const escaped = escapeRegExp(folder).replaceAll('/', () => PATH_SEPARATOR_PATTERN);
        patterns.push(`${PATH_SEPARATOR_PATTERN}${escaped}${PATH_SEPARATOR_PATTERN}`);
    }
    return patterns;
}

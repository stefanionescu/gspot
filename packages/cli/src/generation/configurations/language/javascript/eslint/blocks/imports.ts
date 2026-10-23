import picomatch from 'picomatch';
import { joinScope } from '#cli/repository/scopes.ts';
import { findParentScope } from '#cli/settings/scopes.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import { type Scope } from '#cli/types/settings/inheritance.ts';
import { readScopeAliases, readPackageAliases } from '#cli/repository/npm/aliases.ts';
import { FOLDER_CONTENTS, GLOB_SPECIAL_CHARACTERS } from '#cli/config/files/path-patterns.ts';

import {
    type EslintBlock,
    type PlannedEslintFile,
    type EslintImportBoundaryRule,
} from '#cli/types/generation/eslint.ts';
import {
    buildNodePatterns,
    buildSourcePattern,
    listNestedScopeGlobs,
} from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import {
    CODE_LANGUAGES,
    ESLINT_SETTINGS_TABLE,
    IMPORT_BOUNDARIES_RULE,
} from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import {
    REGEX_SYMBOLS,
    ANY_DEPTH_PREFIX,
    IMPORT_EXTENSIONS,
    EXTENSIONLESS_CODE,
    FILE_EXTENSION_RULE,
    NODE_SCRIPT_PATTERNS,
    PATH_SEPARATOR_PATTERN,
    IMPORT_BOUNDARY_FOLDERS,
    TYPESCRIPT_EXTENSION_MAP,
} from '#cli/config/generation/configurations/language/javascript/eslint/blocks/imports.ts';

/**
 * Build the n/file-extension-in-import blocks for each project and path style.
 *
 * @param scopes the projects and their import styles.
 * @param nodeFiles your own scripts that run on Node.js.
 * @returns the lint rule and TypeScript extension settings for each project.
 */
export function buildImportStyleBlocks(scopes: Scope[], nodeFiles: string[]): EslintBlock[] {
    const changed = scopes.filter((scope) => {
        const parent = findParentScope(scopes, scope.folder.path);
        return (
            scope.settings.values[ESLINT_SETTINGS_TABLE]?.import_extension !==
            parent?.settings.values[ESLINT_SETTINGS_TABLE]?.import_extension
        );
    });
    return changed.flatMap((scope) => {
        const path = scope.folder.path;
        const styles = scope.settings.values[ESLINT_SETTINGS_TABLE]?.import_extension;
        return styles === undefined
            ? []
            : [
                  {
                      files: [buildSourcePattern(...CODE_LANGUAGES), ...buildNodePatterns(nodeFiles, path)].map(
                          (pattern) => [
                              joinScope(path.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH), '**/*'),
                              pattern,
                          ],
                      ),
                      ignores: listNestedScopeGlobs(
                          changed.map(({ folder }) => folder.path),
                          path,
                      ),
                      settings: {
                          n: {
                              tryExtensions: IMPORT_EXTENSIONS,
                              typescriptExtensionMap: styles === 'js' ? TYPESCRIPT_EXTENSION_MAP : [],
                          },
                      },
                      rules: {
                          [FILE_EXTENSION_RULE]:
                              styles === 'extensionless'
                                  ? ['error', 'always', EXTENSIONLESS_CODE]
                                  : ['error', 'always'],
                      },
                  },
              ];
    });
}

/**
 * Build one relative-import boundary rule from the project folders and aliases. The root and nested rules share the
 * boundary folders and the aliases of their project.
 *
 * @param scopes the projects and their settings.
 * @param aliases the repository-relative alias paths.
 * @returns the relative-import rule setting with its folders and aliases.
 */
export function buildImportBoundariesRule(scopes: Scope[], aliases: Record<string, string>): EslintImportBoundaryRule {
    const scopePaths = scopes
        .map((scope) => scope.folder.path.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH))
        .filter((path) => path !== '');
    const externals = [...new Set(scopes.flatMap(({ settings }) => settings.values.javascript?.externals ?? []))];
    return [
        'error',
        {
            folders: [...IMPORT_BOUNDARY_FOLDERS, ...scopePaths],
            aliases,
            ...(externals.length === 0 ? {} : { externals }),
        },
    ];
}

/**
 * Resolve nested project boundaries against the aliases of each project.
 *
 * @param planned the scopes and Node.js script paths to cover.
 * @returns the boundary-rule blocks with the aliases of each project.
 */
export function buildScopeImportBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintBlock[] {
    const {
        session: { root, reads, scopes },
        nodeFiles,
    } = planned;
    return scopes
        .filter((scope) => scope.folder.path !== '')
        .map((scope) => {
            const path = scope.folder.path;
            const aliases = readScopeAliases(root, path, reads);
            return {
                files: [
                    joinScope(
                        path.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH),
                        buildSourcePattern(...CODE_LANGUAGES),
                    ),
                    ...buildNodePatterns(nodeFiles, path),
                ],
                rules: {
                    [IMPORT_BOUNDARIES_RULE]: buildImportBoundariesRule(scopes, aliases),
                },
            };
        });
}

/**
 * Keep the imports of Node scripts runnable: Node needs full file names, and resolves only package.json imports.
 * These blocks come after the style and project blocks, so they win for .mjs, .cjs, and Node shebang files.
 *
 * @param planned the scopes and the Node scripts without a code extension.
 * @returns one block for each project.
 */
export function buildNodeScriptBlocks(planned: Pick<PlannedEslintFile, 'session' | 'nodeFiles'>): EslintBlock[] {
    const {
        session: { root, scopes },
        nodeFiles,
    } = planned;
    const paths = scopes.map((scope) => scope.folder.path);
    return scopes.map((scope) => {
        const path = scope.folder.path;
        return {
            files: [
                ...NODE_SCRIPT_PATTERNS.map((pattern) =>
                    joinScope(path.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH), pattern),
                ),
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
 * Turn the ignored folder globs into the patterns that import-x/ignore matches against resolved module paths, so the
 * import rules never parse a gitignored bundle or build output.
 *
 * @param globs the ignore globs of the ESLint file.
 * @returns a pattern for each ignored folder without other wildcards.
 */
export function buildImportIgnores(globs: string[]): string[] {
    return globs.flatMap((glob) => {
        if (glob.startsWith('!') || !glob.endsWith(FOLDER_CONTENTS)) return [];
        const folder = glob.slice(0, -FOLDER_CONTENTS.length).replace(ANY_DEPTH_PREFIX, '');
        if (folder === '' || picomatch.scan(folder).isGlob) return [];
        const escaped = folder
            .replaceAll(REGEX_SYMBOLS, BACKSLASH_BEFORE_MATCH)
            .replaceAll('/', PATH_SEPARATOR_PATTERN);
        return [`${PATH_SEPARATOR_PATTERN}${escaped}${PATH_SEPARATOR_PATTERN}`];
    });
}

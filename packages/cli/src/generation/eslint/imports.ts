import picomatch from 'picomatch';
import { joinScope } from '#cli/repository/scopes.ts';
import { escapeGlob } from '#cli/repository/matchers.ts';
import { FOLDER_CONTENTS } from '#cli/config/system/paths.ts';
import { type ScopeSelection } from '#cli/types/settings/values.ts';
import { findParentSelection } from '#cli/generation/eslint/lint-rules.ts';
import { readScopeAliases, readPackageAliases } from '#cli/generation/eslint/aliases.ts';
import { type EslintBlock, type EslintContext, type EslintImportBoundaryRule } from '#cli/types/generation/eslint.ts';

import {
    buildScopeGlob,
    buildNodePatterns,
    buildSourcePattern,
    listNestedScopeGlobs,
} from '#cli/generation/eslint/files.ts';
import {
    REGEX_SYMBOLS,
    CODE_LANGUAGES,
    ANY_DEPTH_PREFIX,
    IMPORT_EXTENSIONS,
    EXTENSIONLESS_CODE,
    FILE_EXTENSION_RULE,
    NODE_SCRIPT_PATTERNS,
    ESLINT_SETTINGS_TABLE,
    PATH_SEPARATOR_PATTERN,
    IMPORT_BOUNDARIES_RULE,
    ESLINT_BOUNDARY_FOLDERS,
    TYPESCRIPT_EXTENSION_MAP,
} from '#cli/config/generation/eslint.ts';

/**
 * Build the relative-import lint rules for each project and path style.
 *
 * @param scopes the projects and their import styles.
 * @param nodeFiles your own scripts that run on Node.js.
 *
 * @returns the lint rule and TypeScript extension settings for each project.
 */
function buildImportStyleBlocks(scopes: ScopeSelection[], nodeFiles: string[]): EslintBlock[] {
    const changed = scopes.filter((entry) => {
        const parent = findParentSelection(scopes, entry.scope.path);
        return (
            entry.view.values[ESLINT_SETTINGS_TABLE]?.import_extension !==
            parent?.view.values[ESLINT_SETTINGS_TABLE]?.import_extension
        );
    });
    return changed.flatMap((entry) => {
        const path = entry.scope.path;
        const styles = entry.view.values[ESLINT_SETTINGS_TABLE]?.import_extension;
        return styles === undefined
            ? []
            : [
                  {
                      files: [buildSourcePattern(...CODE_LANGUAGES), ...buildNodePatterns(nodeFiles, path)].map(
                          (pattern) => [buildScopeGlob(path, '**/*'), pattern],
                      ),
                      ignores: listNestedScopeGlobs(
                          changed.map(({ scope }) => scope.path),
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
 * Build one relative-import boundary rule from the project folders and aliases.
 * The root and nested rules share the boundary folders and the aliases of their project.
 *
 * @param scopes the projects and their settings.
 * @param aliases the repository-relative alias targets.
 * @returns the relative-import rule setting with its folders and aliases.
 */
function buildImportBoundariesRule(
    scopes: ScopeSelection[],
    aliases: Record<string, string>,
): EslintImportBoundaryRule {
    const scopePaths = scopes.map((entry) => escapeGlob(entry.scope.path)).filter((path) => path !== '');
    const externals = [...new Set(scopes.flatMap(({ view }) => view.values.javascript?.externals ?? []))];
    return [
        'error',
        {
            folders: [...ESLINT_BOUNDARY_FOLDERS, ...scopePaths],
            aliases,
            ...(externals.length === 0 ? {} : { externals }),
        },
    ];
}

/**
 * Resolve nested project boundaries against the aliases of each project.
 *
 * @param context the scopes and Node.js script paths to cover.
 * @returns the boundary-rule blocks with the aliases of each project.
 */
function buildScopeImportBlocks(context: Pick<EslintContext, 'session' | 'nodeFiles'>): EslintBlock[] {
    const {
        session: { root, reads, scopes },
        nodeFiles,
    } = context;
    return scopes
        .filter((entry) => entry.scope.path !== '')
        .map((entry) => {
            const path = entry.scope.path;
            const aliases = readScopeAliases(root, path, reads);
            return {
                files: [
                    buildScopeGlob(path, buildSourcePattern(...CODE_LANGUAGES)),
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
 * @param context the scopes and the Node scripts without a code extension.
 * @returns one block for each project.
 */
function buildNodeScriptBlocks(context: Pick<EslintContext, 'session' | 'nodeFiles'>): EslintBlock[] {
    const {
        session: { root, scopes },
        nodeFiles,
    } = context;
    const paths = scopes.map((entry) => entry.scope.path);
    return scopes.map((entry) => {
        const path = entry.scope.path;
        return {
            files: [
                ...NODE_SCRIPT_PATTERNS.map((pattern) => buildScopeGlob(path, pattern)),
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
function buildImportIgnores(globs: string[]): string[] {
    return globs.flatMap((glob) => {
        if (glob.startsWith('!') || !glob.endsWith(FOLDER_CONTENTS)) return [];
        const folder = glob.slice(0, -FOLDER_CONTENTS.length).replace(ANY_DEPTH_PREFIX, '');
        if (folder === '' || picomatch.scan(folder).isGlob) return [];
        const escaped = folder.replaceAll(REGEX_SYMBOLS, String.raw`\$&`).replaceAll('/', PATH_SEPARATOR_PATTERN);
        return [`${PATH_SEPARATOR_PATTERN}${escaped}${PATH_SEPARATOR_PATTERN}`];
    });
}

export {
    buildImportIgnores,
    buildNodeScriptBlocks,
    buildImportStyleBlocks,
    buildScopeImportBlocks,
    buildImportBoundariesRule,
};

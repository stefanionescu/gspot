import { escapeGlob } from '#cli/repository/matchers.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import { type ScopeSelection } from '#cli/types/settings/values.ts';
import { readScopeAliases } from '#cli/generation/eslint/aliases.ts';
import { findParentSelection } from '#cli/generation/eslint/lint-rules.ts';
import { buildNodePatterns, buildSourcePattern } from '#cli/generation/eslint/files.ts';
import { type EslintBlock, type EslintContext, type EslintImportBoundaryRule } from '#cli/types/generation/eslint.ts';

import {
    CODE_LANGUAGES,
    IMPORT_EXTENSIONS,
    FILE_EXTENSION_RULE,
    ESLINT_SETTINGS_TABLE,
    IMPORT_BOUNDARIES_RULE,
    ESLINT_BOUNDARY_FOLDERS,
    TYPESCRIPT_EXTENSION_MAP,
} from '#cli/config/generation/eslint.ts';

/**
 * Build relative-import rules for each selected project and path style.
 *
 * @param scopes selected projects and their import styles.
 * @param nodeFiles your own files selected for Node.js execution.
 *
 * @returns rule and TypeScript-extension settings restricted to each project.
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
        const children = listNestedScopes(
            changed.map(({ scope }) => scope.path),
            path,
        );
        const styles = entry.view.values[ESLINT_SETTINGS_TABLE]?.import_extension;
        return styles === undefined
            ? []
            : [
                  {
                      files: [buildSourcePattern(...CODE_LANGUAGES), ...buildNodePatterns(nodeFiles, path)].map(
                          (pattern) => [path === '' ? '**/*' : `${escapeGlob(path)}/**/*`, pattern],
                      ),
                      ignores: children.map((child) => `${escapeGlob(child)}/**`),
                      settings: {
                          n: {
                              tryExtensions: IMPORT_EXTENSIONS,
                              typescriptExtensionMap: styles === 'js' ? TYPESCRIPT_EXTENSION_MAP : [],
                          },
                      },
                      rules: { [FILE_EXTENSION_RULE]: ['error', styles === 'extensionless' ? 'never' : 'always'] },
                  },
              ];
    });
}

// Root and nested rules share the same boundary folders and their project's aliases.
/**
 * Build one relative-import boundary rule from the project folders and aliases.
 * @param scopes the selected projects and their effective settings.
 * @param aliases the repository-relative import alias destinations.
 * @returns the relative-import rule setting with its folders and aliases.
 */
function buildImportBoundariesRule(
    scopes: ScopeSelection[],
    aliases: Record<string, string>,
): EslintImportBoundaryRule {
    const scopePaths = scopes.map((entry) => escapeGlob(entry.scope.path)).filter((path) => path !== '');
    return ['error', { folders: [...ESLINT_BOUNDARY_FOLDERS, ...scopePaths], aliases }];
}

// Each nested scope resolves its import boundaries against its own aliases.
/**
 * Resolve nested project boundaries against the aliases of each project.
 * @param context the repository root, read cache, selected scopes, and Node.js script paths.
 * @returns the boundary-rule blocks with the aliases of each project.
 */
function buildScopeImportBlocks(
    context: Pick<EslintContext, 'root' | 'reads' | 'scopes' | 'nodeFiles'>,
): EslintBlock[] {
    const { root, reads, scopes, nodeFiles } = context;
    return scopes
        .filter((entry) => entry.scope.path !== '')
        .map((entry) => {
            const path = entry.scope.path;
            const aliases = readScopeAliases(root, path, reads);
            return {
                files: [
                    `${escapeGlob(path)}/${buildSourcePattern(...CODE_LANGUAGES)}`,
                    ...buildNodePatterns(nodeFiles, path),
                ],
                rules: {
                    [IMPORT_BOUNDARIES_RULE]: buildImportBoundariesRule(scopes, aliases),
                },
            };
        });
}

export { buildScopeImportBlocks, buildImportBoundariesRule };
export { buildImportStyleBlocks };

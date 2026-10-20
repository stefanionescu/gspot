import { posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { escapeGlob } from '#cli/repository/matchers.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/eslint.ts';
import type { EslintPlugins, EslintSettingsBlock } from '#cli/types/generation/eslint.ts';

function listPluginRecords(scopes: ScopeSelection[]) {
    return scopes
        .filter(({ view }) => view.configurations.includes('javascript'))
        .flatMap((selection) =>
            selection.view
                .options(ESLINT_SETTINGS_TABLE)
                .plugins.map((plugin) => ({ ...plugin, scope: selection.scope.path })),
        );
}

/**
 * List the import of each plugin module, keyed by its rule prefix, as the generated file imports it.
 *
 * @param scopes every project and its settings.
 * @param targetPath the generated ESLint file, which imports each module by a path relative to it.
 * @param shipped the plugins that gspot loads, whose prefixes your plugins may not take.
 * @returns the imports of your plugins.
 */
export function listLocalPlugins(scopes: ScopeSelection[], targetPath: string, shipped: EslintPlugins): EslintPlugins {
    const records = listPluginRecords(scopes);
    const paths = new Map(records.map((record) => [record.name, record.path]));
    return Object.fromEntries(
        [...paths].map(([name, path], index) => {
            if (Object.hasOwn(shipped, name))
                throw new GspotError(
                    'settings',
                    `tools.eslint.plugins: ${name} is the rule prefix of a plugin that gspot loads. Choose another name.`,
                );
            const relative = posix.relative(posix.dirname(targetPath), path);
            return [
                name,
                [`localPlugin${String(index)}`, relative.startsWith('.') ? relative : `./${relative}`] as const,
            ];
        }),
    );
}

/**
 * Build one block per plugin record that turns its rules on as errors for the code files of its scope.
 *
 * @param scopes every project and its settings.
 * @param codeFiles the code file patterns of the ESLint file.
 * @returns the rule blocks of your plugins.
 */
export function buildLocalPluginBlocks(scopes: ScopeSelection[], codeFiles: string[]): EslintSettingsBlock[] {
    return listPluginRecords(scopes).map(({ name, rules, scope }) => ({
        files: scope === '' ? codeFiles : codeFiles.map((pattern) => [pattern, joinScope(escapeGlob(scope), '**/*')]),
        rules: Object.fromEntries(
            Object.entries(rules).map(([rule, options]) => [`${name}/${rule}`, ['error', ...options]]),
        ),
    }));
}

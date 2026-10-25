import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { getTable, findParentScope } from '#cli/settings/scopes.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { buildRelativeTarget } from '#cli/generation/config-files/pointers.ts';
import type { EslintPlugins, EslintBlockFields } from '#cli/types/generation/eslint.ts';
import { buildScopeGlob } from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';

function listPluginRecords(scopes: Scope[]) {
    return scopes
        .filter(({ settings }) => settings.configurations.includes(JAVASCRIPT_CONFIGURATION))
        .flatMap((scope) => {
            const parent = findParentScope(scopes, scope.folder.path);
            const inherited = parent?.settings.values[ESLINT_SETTINGS_TABLE]?.plugins ?? [];
            return getTable(scope.settings, ESLINT_SETTINGS_TABLE)
                .plugins.filter((plugin) => inherited.every((record) => !isDeepStrictEqual(record, plugin)))
                .map((plugin) => ({ ...plugin, scope: scope.folder.path }));
        });
}

/**
List the import of each plugin module, keyed by its rule prefix, as the generated file imports it.

@param scopes every project and its settings.
@param targetPath the generated ESLint file, which imports each module by a path relative to it.
@param shipped the plugins that gspot loads, whose prefixes your plugins may not take.
@returns the imports of your plugins.
*/
export function listLocalPlugins(scopes: Scope[], targetPath: string, shipped: EslintPlugins): EslintPlugins {
    const records = listPluginRecords(scopes);
    const paths = new Map<string, string>();
    for (const { name, path } of records) {
        const previous = paths.get(name);
        if (previous !== undefined && previous !== path)
            throw new GspotError(
                'settings',
                `tools.eslint.plugins: ${name} names two modules, ${previous} and ${path}. Give each its own prefix.`,
            );
        paths.set(name, path);
    }
    return Object.fromEntries(
        [...paths].map(([name, path], index) => {
            if (Object.hasOwn(shipped, name))
                throw new GspotError(
                    'settings',
                    `tools.eslint.plugins: ${name} is the rule prefix of a plugin that gspot loads. Choose another name.`,
                );
            return [name, [`localPlugin${String(index)}`, buildRelativeTarget(targetPath, path)] as const];
        }),
    );
}

/**
Build one block per plugin record that turns its rules on as errors for the code files of its scope.

@param scopes every project and its settings.
@param codeFiles the code file patterns of the ESLint file.
@returns the rule blocks of your plugins.
*/
export function buildLocalPluginBlocks(scopes: Scope[], codeFiles: string[]): EslintBlockFields[] {
    return listPluginRecords(scopes).map(({ name, rules, scope }) => ({
        files: scope === '' ? codeFiles : codeFiles.map((pattern) => [pattern, buildScopeGlob(scope)]),
        rules: Object.fromEntries(
            Object.entries(rules).map(([rule, options]) => [`${name}/${rule}`, ['error', ...options]]),
        ),
    }));
}

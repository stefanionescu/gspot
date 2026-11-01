import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import type { Scope } from '#cli/types/settings.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { getTable, findParentScope } from '#cli/settings/scopes.ts';
import { escapeGlob, buildModuleSpecifier } from '#cli/system/paths.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/configurations/blocks.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/configurations/javascript.ts';
import type { EslintPlugins, EslintBlockFields } from '#cli/types/configurations/language.ts';

function listPluginRecords(scopes: Scope[]) {
    return scopes
        .filter(({ settings }) => settings.configurations.includes(JAVASCRIPT_CONFIGURATION))
        .flatMap((scope) => {
            const parent = findParentScope(scopes, scope.path);
            const inherited = parent?.settings.tables[ESLINT_SETTINGS_TABLE]?.plugins ?? [];
            return getTable(scope.settings, ESLINT_SETTINGS_TABLE)
                .plugins.filter((plugin) => inherited.every((record) => !isDeepStrictEqual(record, plugin)))
                .map((plugin) => ({ ...plugin, scope: scope.path }));
        });
}

/**
List the import of each plugin module, keyed by its rule prefix, as the generated file imports it.

@param scopes every project and its settings.
@param targetPath the generated ESLint file, which imports each module by a path relative to it.
@param shipped the plugins that gspot loads, whose prefixes your plugins may not take.
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
            return [name, [`localPlugin${String(index)}`, buildModuleSpecifier(targetPath, path)] as const];
        }),
    );
}

/**
Build one block per plugin record that turns its rules on as errors for the code files of its scope.

@param scopes every project and its settings.
@param codeFiles the code file patterns of the ESLint file.
*/
export function buildLocalPluginBlocks(scopes: Scope[], codeFiles: string[]): EslintBlockFields[] {
    return listPluginRecords(scopes).map(({ name, rules, scope }) => ({
        files: scope === '' ? codeFiles : codeFiles.map((pattern) => [pattern, joinScope(escapeGlob(scope), '**/*')]),
        rules: Object.fromEntries(
            Object.entries(rules).map(([rule, options]) => [`${name}/${rule}`, ['error', ...options]]),
        ),
    }));
}

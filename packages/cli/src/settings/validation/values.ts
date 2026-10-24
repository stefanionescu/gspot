import { isTable } from '#cli/system/tables.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { FIRST_READ } from '#cli/config/generation/rules.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { listRuleFiles } from '#cli/configurations/manifests.ts';
import { type Configuration } from '#cli/types/configurations.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { formatCodeList, formatSimilarNames } from '#cli/system/text.ts';
import { SETTING_RULES } from '#cli/config/settings/validation/values.ts';
import { type Settings, type SettingsError } from '#cli/types/settings/file.ts';
import { ESLINT_LIMIT_RULES } from '#cli/config/generation/configurations/language/javascript/eslint/blocks/base.ts';

function readPathError(files: Files, value: string): ReturnType<Files['readStats']> | Error {
    try {
        return files.readStats(value);
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        return error;
    }
}

/**
 * Refuse scope paths that name a file, and keep written scopes whose folder does not exist yet.
 *
 * @param repositoryRoot the base folder for each written scope path.
 * @param settings the normalized gspot.toml.
 * @returns the errors in plain English.
 */
export function validateScopePaths(repositoryRoot: string, settings: Settings): SettingsError[] {
    const paths = Object.values(settings.scopes).map((table) => table.written['path'] as string);
    using files = openFiles(repositoryRoot);
    return paths.flatMap((path) => {
        const location: KeyPath = ['scope', path];
        const stats = readPathError(files, trimTrailingSlashes(path));
        if (stats instanceof Error) return [{ path: location, message: stats.message }];
        return stats === undefined || stats.isDirectory()
            ? []
            : [
                  {
                      path: location,
                      message: `The scope \`${path}\` names a file. Name a folder under the repository root.`,
                  },
              ];
    });
}

/**
 * Check the rule file paths of the root and every scope against the repository files.
 *
 * @param repositoryRoot the folder the paths start from.
 * @param settings the parsed gspot.toml.
 * @returns an error at each key that names no file.
 */
export function validateRuleFilePaths(repositoryRoot: string, settings: Settings): SettingsError[] {
    using files = openFiles(repositoryRoot);
    return listSettingsTables(settings).flatMap(({ table, path }) => {
        const plugins = table.tools?.['eslint']?.['plugins'];
        const ruleFiles = table.tools?.['semgrep']?.['rule_files'];
        const paths = [
            ...(Array.isArray(plugins)
                ? plugins.map((plugin: { path: string }, index) => ({
                      value: plugin.path,
                      key: 'path',
                      path: [...path, 'tools', 'eslint', 'plugins', index, 'path'],
                  }))
                : []),
            ...(Array.isArray(ruleFiles)
                ? ruleFiles.map((value: string, index) => ({
                      value,
                      key: 'rule_files',
                      path: [...path, 'tools', 'semgrep', 'rule_files', index],
                  }))
                : []),
        ];
        return paths.flatMap(({ value, key, path }) => {
            const stats = readPathError(files, value);
            if (stats instanceof Error)
                return [
                    {
                        path,
                        message: stats.message.replace(
                            'gspot does not write through links.',
                            `Point ${key} at a tracked file.`,
                        ),
                    },
                ];
            return stats?.isFile() === true
                ? []
                : [
                      {
                          path,
                          message: `\`${value}\` names no file. Point ${key} at a file, relative to the repository root.`,
                      },
                  ];
        });
    });
}

/**
 * Find the errors in [rules] exclude: an item that matches no rule, and an item that hides a file that the reader opens
 * first.
 *
 * @param exclude the written items, relative to the rules folder.
 * @param configurations the shipped configurations by name.
 * @returns each error with its position in the exclusion list.
 */
export function validateRuleExcludes(exclude: string[], configurations: Map<string, Configuration>): SettingsError[] {
    if (exclude.length === 0) return [];
    const paths = [...configurations.values()].flatMap((configuration) =>
        listRuleFiles(configuration).map((file) => file.path),
    );
    return exclude.flatMap((excluded, index) => {
        if (
            FIRST_READ.some((file) => isInScope(`${GSPOT_PATHS.configurations}/${file}`, trimTrailingSlashes(excluded)))
        )
            return [
                {
                    path: ['rules', 'exclude', index],
                    message: `[rules] exclude names ${formatCodeList([excluded])}, which holds a file every agent opens first (${formatCodeList(FIRST_READ)}). Remove the entry.`,
                },
            ];
        if (paths.some((path) => isInScope(`${GSPOT_PATHS.configurations}/${path}`, trimTrailingSlashes(excluded))))
            return [];
        const suggestion = formatSimilarNames(
            excluded,
            paths.map((path) => `${GSPOT_PATHS.configurations}/${path}`),
        );
        return [
            {
                path: ['rules', 'exclude', index],
                message: `[rules] exclude names ${formatCodeList([excluded])}, which matches no rule.${suggestion}`,
            },
        ];
    });
}

/**
 * Refuse rule options whose values come from another gspot setting.
 *
 * @param settings the root settings and every scope.
 * @returns the settings errors with the key that owns each value.
 */
export function validateSettingRules(settings: Settings): SettingsError[] {
    const limitRules = Object.fromEntries(
        Object.entries(ESLINT_LIMIT_RULES).map(([rule, setting]) => [rule, `limits.${setting.limit}`]),
    );
    const owned = new Map(
        Object.entries({ ...SETTING_RULES, eslint: { ...limitRules, ...SETTING_RULES['eslint'] } }).map(
            ([tool, rules]) => [tool, new Map(Object.entries(rules))],
        ),
    );
    return listSettingsTables(settings).flatMap(({ table, path }) => {
        const eslint = table.tools?.['eslint'];
        const overrides = eslint !== undefined && 'override' in eslint ? eslint['override'] : undefined;
        const tables = [
            { tool: 'eslint', rules: eslint?.['rules'], path: [...path, 'tools', 'eslint', 'rules'] },
            {
                tool: 'markdownlint',
                rules: table.tools?.['markdownlint']?.['rules'],
                path: [...path, 'tools', 'markdownlint', 'rules'],
            },
            ...(Array.isArray(overrides)
                ? overrides.flatMap((override: unknown, index) =>
                      isTable(override)
                          ? [
                                {
                                    tool: 'eslint',
                                    rules: override['rules'],
                                    path: [...path, 'tools', 'eslint', 'override', index, 'rules'],
                                },
                            ]
                          : [],
                  )
                : []),
        ];
        return tables.flatMap(({ tool, rules, path }) => {
            if (!isTable(rules)) return [];
            return Object.keys(rules).flatMap((rule) => {
                const setting = owned.get(tool)?.get(rule);
                if (setting === undefined) return [];
                return [
                    {
                        path: [...path, rule],
                        message:
                            setting === '[[import_rule]]'
                                ? `gspot writes the options of ${rule} from the [[import_rule]] records. Change those records instead.`
                                : `gspot writes the options of ${rule} from ${setting}. Change that setting instead: gspot set ${setting} <value>, with --reason when you raise it.`,
                    },
                ];
            });
        });
    });
}

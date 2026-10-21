import { isRecord } from '#cli/system/values.ts';
import { FIRST_READ } from '#cli/config/rules.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { SETTING_RULES } from '#cli/config/settings/schema.ts';
import { listRuleFiles } from '#cli/configurations/manifests.ts';
import type { SettingsError } from '#cli/types/settings/file.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { ESLINT_LIMIT_RULES } from '#cli/config/generation/eslint.ts';
import { formatCodeList, formatSimilarNames } from '#cli/system/text.ts';
import { GSPOT_CONFIGURATIONS_PATH } from '#cli/config/system/locations.ts';

/**
 * Refuse scope paths that name a file or repeat, and keep written scopes whose folder does not exist yet.
 *
 * @param repositoryRoot the base folder for each written scope path.
 * @param settings the normalized gspot.toml.
 * @returns the errors in plain English.
 */
function validateScopePaths(repositoryRoot: string, settings: Settings): SettingsError[] {
    const paths = Object.values(settings.scopes).map((table) => table.written['path'] as string);
    using files = openFiles(repositoryRoot);
    return paths.flatMap((path) => {
        const location: KeyPath = ['scope', path];
        try {
            const entry = files.readStats(trimTrailingSlashes(path));
            return entry === undefined || entry.isDirectory()
                ? []
                : [
                      {
                          path: location,
                          message: `The scope \`${path}\` names a file. Declare a directory under the repository root.`,
                      },
                  ];
        } catch (error) {
            if (!(error instanceof Error)) throw error;
            return [{ path: location, message: error.message }];
        }
    });
}

/**
 * Check the rule file paths of the root and every scope against the repository files.
 *
 * @param repositoryRoot the folder the paths start from.
 * @param settings the parsed gspot.toml.
 * @returns an error at each key that names no file.
 */
function validateRuleFilePaths(repositoryRoot: string, settings: Settings): SettingsError[] {
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
        return paths.flatMap(({ value, key, path }) =>
            files.readStats(value)?.isFile() === true
                ? []
                : [
                      {
                          path,
                          message: `\`${value}\` names no file. Point ${key} at a file, relative to the repository root.`,
                      },
                  ],
        );
    });
}

/**
 * Find the errors in [rules] exclude: an item that matches no rule, and an item that hides a file that the reader opens first.
 *
 * @param exclude the written items, relative to the rules folder.
 * @param manifests the shipped configuration declarations indexed by name.
 * @returns each error with its position in the exclusion list.
 */
function validateRuleExcludes(exclude: string[], manifests: Map<string, Manifest>): SettingsError[] {
    if (exclude.length === 0) return [];
    const paths = [...manifests.values()].flatMap((manifest) => listRuleFiles(manifest).map((file) => file.path));
    return exclude.flatMap((entry, index) => {
        if (FIRST_READ.some((file) => isInScope(`${GSPOT_CONFIGURATIONS_PATH}/${file}`, trimTrailingSlashes(entry))))
            return [
                {
                    path: ['rules', 'exclude', index],
                    message: `[rules] exclude names ${formatCodeList([entry])}, which holds a file every agent opens first (${formatCodeList(FIRST_READ)}). Remove the entry.`,
                },
            ];
        if (paths.some((path) => isInScope(`${GSPOT_CONFIGURATIONS_PATH}/${path}`, trimTrailingSlashes(entry))))
            return [];
        const hint = formatSimilarNames(
            entry,
            paths.map((path) => `${GSPOT_CONFIGURATIONS_PATH}/${path}`),
        );
        return [
            {
                path: ['rules', 'exclude', index],
                message: `[rules] exclude names ${formatCodeList([entry])}, which matches no rule.${hint}`,
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
function validateSettingRules(settings: Settings): SettingsError[] {
    const limitRules = Object.fromEntries(
        Object.entries(ESLINT_LIMIT_RULES).map(([rule, declaration]) => [rule, `limits.${declaration.limit}`]),
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
                      isRecord(override)
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
            if (!isRecord(rules)) return [];
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

export { validateScopePaths, validateSettingRules, validateRuleExcludes, validateRuleFilePaths };

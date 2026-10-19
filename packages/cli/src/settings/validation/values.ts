import { FIRST_READ } from '#cli/config/rules.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { isRecord, getValueAt } from '#cli/system/values.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { GSPOT_CONFIGURATIONS_PATH } from '#cli/config/system/locations.ts';
import type { Settings, SettingsTable } from '#cli/types/settings/values.ts';
import { listRuleFiles, listChecksById } from '#cli/configurations/manifests.ts';
import { type Manifest, type ToolDeclaration } from '#cli/types/configurations.ts';
import { quoteArgument, formatCodeList, selectSimilarNames } from '#cli/system/text.ts';
import type { ToolTable, SettingsError, RuleExcludeError } from '#cli/types/settings/file.ts';

function validateToolRules(
    tool: string,
    table: ToolTable,
    path: KeyPath,
    manifests: Map<string, Manifest>,
): SettingsError[] {
    const rules = table['rules'];
    if (!isRecord(rules)) return [];
    const declarations: Readonly<
        Record<string, { description: string } & Partial<Record<'off_values', readonly (string | number | boolean)[]>>>
    > = SETTING_DECLARATIONS;
    const offValues = declarations[`tools.${tool}.rules`]?.off_values;
    if (offValues === undefined) return [];
    const disabled = Object.entries(rules).filter(([, option]) => {
        const severity: unknown = Array.isArray(option) ? option[0] : option;
        return (
            (typeof severity === 'string' || typeof severity === 'number' || typeof severity === 'boolean') &&
            offValues.includes(severity)
        );
    });
    if (disabled.length === 0) return [];
    // Tool settings use the check ID, which can differ from its executable.
    const check = [...listChecksById(manifests.values()).values()].find(({ check }) =>
        check.name.endsWith(`/${tool}`),
    )?.check;
    const name = check === undefined ? '<check>' : quoteArgument(check.name);
    return disabled.map(([rule]) => {
        return {
            path: [...path, 'rules', rule],
            message: `Disable a rule with an ignore. Run: gspot ignore ${name} --rule ${quoteArgument(rule)} --reason "..."`,
        };
    });
}

/**
 * Report rules turned off outside the ignore settings.
 * @param settings the normalized gspot.toml.
 * @param manifests the shipped configuration declarations indexed by name.
 * @returns the refused changes, at both levels.
 */
function validateDisabledRules(settings: Settings, manifests: Map<string, Manifest>): SettingsError[] {
    const exclusions = validateRuleExcludes(settings.rules.exclude, manifests).map(({ index, message }) => ({
        path: ['rules', 'exclude', index],
        message,
    }));
    return [
        ...exclusions,
        ...listSettingsTables(settings).flatMap(({ table, path }) =>
            (table.tools === undefined ? [] : Object.entries(table.tools)).flatMap(([tool, table]) => {
                const location = [...path, 'tools', tool];
                const overrides = Array.isArray(table['override']) ? table['override'] : [];
                return [
                    ...validateToolRules(tool, table, location, manifests),
                    ...overrides.flatMap((override: unknown, index) =>
                        isRecord(override)
                            ? validateToolRules(tool, override, [...location, 'override', index], manifests)
                            : [],
                    ),
                ];
            }),
        ),
    ];
}

/**
 * Refuse scope paths that name a file or repeat, and keep written scopes whose folder does not exist yet.
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
            return [{ path: location, message: String(error) }];
        }
    });
}

/**
 * Check that each of your own ESLint plugins names a module file in the repository.
 * @param repositoryRoot the folder the paths start from.
 * @param settings the parsed gspot.toml.
 * @returns an error for each plugin path that names no file.
 */
function validatePluginPaths(repositoryRoot: string, settings: Settings): SettingsError[] {
    const plugins = settings.tools['eslint']?.['plugins'];
    if (!Array.isArray(plugins)) return [];
    using files = openFiles(repositoryRoot);
    return plugins.flatMap((plugin: { path: string }, index) =>
        files.readStats(plugin.path)?.isFile() === true
            ? []
            : [
                  {
                      path: ['tools', 'eslint', 'plugins', index, 'path'],
                      message: `\`${plugin.path}\` names no file. Point path at the plugin module, relative to the repository root.`,
                  },
              ],
    );
}

/**
 * Check tool option constraints declared by tools, including inactive scopes.
 * @param table the written root or scope values.
 * @param tools the declarations with option limits.
 * @returns each refused tool option at its written path.
 */
function validateExtraOptions(table: SettingsTable, tools: ToolDeclaration[]): SettingsError[] {
    const errors: SettingsError[] = [];
    for (const tool of tools) {
        const options = table.tools?.[tool.name]?.['extra'];
        if (options === undefined) continue;
        for (const restriction of tool.refused_options ?? []) {
            const refused = restriction.paths.some((path) => {
                const value = getValueAt(options, path.split('.'));
                return value !== undefined;
            });
            if (refused) errors.push({ path: ['tools', tool.name, 'extra'], message: restriction.message });
        }
    }
    return errors;
}

/**
 * Find the errors in [rules] exclude: an item that matches no rule, and an item that hides a file that the reader opens first.
 * @param exclude the written items, relative to the rules folder.
 * @param manifests the shipped configuration declarations indexed by name.
 * @returns each error with its position in the exclusion list.
 */
function validateRuleExcludes(exclude: string[], manifests: Map<string, Manifest>): RuleExcludeError[] {
    if (exclude.length === 0) return [];
    const paths = [...manifests.values()].flatMap((manifest) => listRuleFiles(manifest).map((file) => file.path));
    return exclude.flatMap((entry, index) => {
        if (FIRST_READ.some((file) => isInScope(`${GSPOT_CONFIGURATIONS_PATH}/${file}`, trimTrailingSlashes(entry))))
            return [
                {
                    index,
                    message: `[rules] exclude names ${formatCodeList([entry])}, which holds a file every agent opens first (${formatCodeList(FIRST_READ)}). Remove the entry.`,
                },
            ];
        if (paths.some((path) => isInScope(`${GSPOT_CONFIGURATIONS_PATH}/${path}`, trimTrailingSlashes(entry))))
            return [];
        const near = selectSimilarNames(
            entry,
            paths.map((path) => `${GSPOT_CONFIGURATIONS_PATH}/${path}`),
        );
        const hint = near.length > 0 ? ` Did you mean ${formatCodeList(near)}?` : '';
        return [{ index, message: `[rules] exclude names ${formatCodeList([entry])}, which matches no rule.${hint}` }];
    });
}

export { validateScopePaths, validatePluginPaths, validateExtraOptions, validateDisabledRules };

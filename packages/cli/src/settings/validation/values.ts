import { FIRST_READ } from '#cli/config/rules.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { isRecord, getValueAt } from '#cli/system/values.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { RULES_DIRECTORY } from '#cli/config/system/locations.ts';
import { listConfigurationSettings } from '#cli/settings/known.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { buildPathKey, trimTrailingSlashes } from '#cli/system/paths.ts';
import { quoteArgument, formatCodeList, selectSimilarNames } from '#cli/system/text.ts';
import type { ToolTable, SettingsError, RuleExcludeError } from '#cli/types/settings/file.ts';
import { listRuleFiles, readManifests, listChecksById } from '#cli/configurations/manifests.ts';

function validateToolRules(tool: string, table: ToolTable, path: KeyPath, reads: ReadCache): SettingsError[] {
    const rules = table['rules'];
    if (!isRecord(rules)) return [];
    const manifests = readManifests(reads);
    const disabledOptions = [...manifests.values()]
        .flatMap((manifest) => listConfigurationSettings(manifest.configuration.name))
        .find((declaration) => declaration.name === `tools.${tool}.rules`)?.offValues;
    if (disabledOptions === undefined) return [];
    const disabled = Object.entries(rules).filter(([, option]) => {
        const severity: unknown = Array.isArray(option) ? option[0] : option;
        return (
            (typeof severity === 'string' || typeof severity === 'number' || typeof severity === 'boolean') &&
            disabledOptions.includes(severity)
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

// Duplicate scope declarations after case and Unicode normalization.
function duplicateScopeErrors(paths: string[]): SettingsError[] {
    const seen = new Set<string>();
    const errors: SettingsError[] = [];
    for (const path of paths) {
        const key = buildPathKey(trimTrailingSlashes(path));
        if (seen.has(key))
            errors.push({
                path: ['scope', path],
                message: `Scope path is declared more than once: ${path}.`,
            });
        seen.add(key);
    }
    return errors;
}

/**
 * Reports rules disabled outside the ignore settings.
 * @param settings the normalized settings
 * @param reads the run cache.
 * @returns the prohibited changes, at both check levels
 */
function validateDisabledRules(settings: Settings, reads: ReadCache): SettingsError[] {
    const exclusions = validateRuleExcludes(settings.rules.exclude, reads).map(({ index, message }) => ({
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
                    ...validateToolRules(tool, table, location, reads),
                    ...overrides.flatMap((override: unknown, index) =>
                        isRecord(override)
                            ? validateToolRules(tool, override, [...location, 'override', index], reads)
                            : [],
                    ),
                ];
            }),
        ),
    ];
}

/**
 * Refuses file-valued or duplicate scope paths while retaining absent written projects.
 * @param root the repository root
 * @param settings the normalized settings
 * @returns the errors in plain English
 */
function validateScopePaths(root: string, settings: Settings): SettingsError[] {
    const paths = Array.isArray(settings.written['scope'])
        ? settings.written['scope'].flatMap((entry) =>
              isRecord(entry) && typeof entry['path'] === 'string' ? [entry['path']] : [],
          )
        : [];
    using files = openFiles(root);
    const missing = paths.flatMap((path) => {
        const location: KeyPath = ['scope', path];
        try {
            const entry = files.stat(trimTrailingSlashes(path));
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
    return [...missing, ...duplicateScopeErrors(paths)];
}

/**
 * Check tool option constraints declared by tools, including inactive scopes.
 * @param table the written root or scope values.
 * @param tools the tool declarations owning refused options.
 * @returns each refused tool option at its written path.
 */
function validateExtraOptions(table: Partial<Settings>, tools: ToolDeclaration[]): SettingsError[] {
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
 * Whether an exclusion names a rule file or an ancestor folder.
 * @param entry the written exclusion.
 * @param path the rule path relative to its folder.
 * @returns whether the entry excludes the rule.
 */
function isExcluded(entry: string, path: string): boolean {
    return isInScope(path, trimTrailingSlashes(entry));
}

/**
 * The errors in [rules] exclude: an entry that matches no rule, and an entry that hides a file the reader opens first.
 * @param exclude the entries as written, relative to the rules folder
 * @param reads the run cache.
 * @returns each error with its position in the exclusion list
 */
function validateRuleExcludes(exclude: string[], reads: ReadCache): RuleExcludeError[] {
    if (exclude.length === 0) return [];
    const paths = [...readManifests(reads).values()].flatMap((manifest) =>
        listRuleFiles(manifest).map((file) => file.path),
    );
    return exclude.flatMap((entry, index) => {
        if ([...FIRST_READ].some((file) => isExcluded(entry, `${RULES_DIRECTORY}/${file}`)))
            return [
                {
                    index,
                    message: `[rules] exclude names ${formatCodeList([entry])}, which holds a file every agent opens first (${formatCodeList([...FIRST_READ])}). Remove the entry.`,
                },
            ];
        if (paths.some((path) => isExcluded(entry, `${RULES_DIRECTORY}/${path}`))) return [];
        const near = selectSimilarNames(
            entry,
            paths.map((path) => `${RULES_DIRECTORY}/${path}`),
        );
        const hint = near.length > 0 ? ` Did you mean ${formatCodeList(near)}?` : '';
        return [{ index, message: `[rules] exclude names ${formatCodeList([entry])}, which matches no rule.${hint}` }];
    });
}

export { isExcluded, validateScopePaths, validateExtraOptions, validateDisabledRules };

import type { Files } from '#cli/types/system.ts';
import { LINK_REFUSAL } from '#cli/config/system.ts';
import type { KeyPath } from '#cli/types/parsers.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { listRuleFiles } from '#cli/manifests/read.ts';
import { joinScopeSelector } from '#cli/settings/paths.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { LIMIT_SETTING_RULES } from '#cli/manifests/limits.ts';
import { formatCodeList, formatSimilarNames } from '#cli/system/text.ts';
import { getSettingValue, listSettingsTables } from '#cli/settings/inherit.ts';
import type { Settings, SettingsError, AvailableSettings, WrittenScopeTable } from '#cli/types/settings.ts';

import {
    FIRST_READ,
    SETTING_RULES,
    SWIFT_TARGET_MESSAGE,
    COVERAGE_LINES_SETTING,
} from '#cli/config/settings/validation.ts';

function readPathStats(files: Files, path: string): ReturnType<Files['findStats']> | Error {
    try {
        const stats = files.findStats(path);
        return stats?.isSymbolicLink() === true ? new Error(`${path} ${LINK_REFUSAL}`) : stats;
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        return error;
    }
}

function listRuleTables({ table, path }: WrittenScopeTable) {
    const eslint = table.tools?.['eslint'];
    const overrides = eslint !== undefined && 'override' in eslint ? eslint.override : undefined;
    return [
        { tool: 'eslint', rules: eslint?.['rules'], path: [...path, 'tools', 'eslint', 'rules'] },
        {
            tool: 'markdownlint',
            rules: table.tools?.['markdownlint']?.['rules'],
            path: [...path, 'tools', 'markdownlint', 'rules'],
        },
        ...(overrides ?? []).map((override, index) => ({
            tool: 'eslint',
            rules: override.rules,
            path: [...path, 'tools', 'eslint', 'override', index, 'rules'],
        })),
    ];
}

/**
Refuse scope paths that name a file, and keep written scopes whose folder does not exist yet.

@param root the base folder for each written scope path.
@param settings the normalized gspot.toml.
*/
export function validateScopePaths(root: string, settings: Settings): SettingsError[] {
    const paths = settings.scopes
        .values()
        .map((table) => table.written['path'] as string)
        .toArray();
    const files = openFiles(root);
    return paths.flatMap((path, index) => {
        const location: KeyPath = ['scope', index, 'path'];
        const stats = readPathStats(files, stripTrailingSlashes(path));
        if (stats instanceof Error) return [{ path: location, message: stats.message }];
        if (stats === undefined || stats.isDirectory()) return [];
        return [
            {
                path: location,
                message: `The scope ${path} names a file. Name a folder under the repository root.`,
            },
        ];
    });
}

/**
Check the rule file paths of the root and every scope against the repository files.

@param root the folder the paths start from.
@param settings the parsed gspot.toml.
@returns an error at each key that names no file.
*/
export function validateRuleFilePaths(root: string, settings: Settings): SettingsError[] {
    const files = openFiles(root);
    return listSettingsTables(settings).flatMap(({ table, scope, path }) => {
        const ruleFiles = table.security?.rule_files;
        const paths = [
            ...(['eslint', 'stylelint'] as const).flatMap((tool) =>
                (table.tools?.[tool]?.['plugins'] ?? []).flatMap(({ path: value }, index) =>
                    value === undefined
                        ? []
                        : [{ value, key: 'path', path: [...path, 'tools', tool, 'plugins', index, 'path'] }],
                ),
            ),
            ...(ruleFiles ?? []).map((value, index) => ({
                value,
                key: 'rule_files',
                path: [...path, 'security', 'rule_files', index],
            })),
        ];
        return paths.flatMap(({ value, key, path }) => {
            const stats = readPathStats(files, joinScopeSelector(value, scope));
            if (stats instanceof Error)
                return [
                    {
                        path,
                        message: stats.message,
                    },
                ];
            if (stats?.isFile() === true) return [];
            return [
                {
                    path,
                    message: `${value} names no file. Point ${key} at a file, relative to its table.`,
                },
            ];
        });
    });
}

/**
Find the errors in [rules] exclude: an item that matches no rule, and an item that hides a file that the reader opens
first.

@param exclude the written items, relative to the rules folder.
@param configurationsByName the shipped configurations by name.
@returns each error with its position in the exclusion list.
*/
export function validateRuleExcludes(
    exclude: string[],
    configurationsByName: ReadonlyMap<string, Configuration>,
): SettingsError[] {
    if (exclude.length === 0) return [];
    const paths = configurationsByName
        .values()
        .flatMap((configuration) => listRuleFiles(configuration).map((file) => file.path))
        .toArray();
    return exclude.flatMap((excluded, index) => {
        const location: KeyPath = ['rule_files', 'exclude', index];
        const hasFirstRead = FIRST_READ.some((file) =>
            isInScope(`${GSPOT_PATHS.rules}/${file}`, stripTrailingSlashes(excluded)),
        );
        if (hasFirstRead)
            return [
                {
                    path: location,
                    message: `[rule_files] exclude names ${formatCodeList([excluded])}, which holds a file every agent opens first (${formatCodeList(FIRST_READ)}). Remove the entry.`,
                },
            ];
        const isRuleMatch = paths.some((path) =>
            isInScope(`${GSPOT_PATHS.rules}/${path}`, stripTrailingSlashes(excluded)),
        );
        if (isRuleMatch) return [];
        const suggestion = formatSimilarNames(
            excluded,
            paths.map((path) => `${GSPOT_PATHS.rules}/${path}`),
        );
        return [
            {
                path: location,
                message: `[rule_files] exclude names ${formatCodeList([excluded])}, which matches no rule.${suggestion}`,
            },
        ];
    });
}

/**
Refuse rule options whose values come from another gspot setting.

@param settings the root settings and every scope.
*/
export function validateSettingRules(settings: Settings): SettingsError[] {
    const tools = new Set([...Object.keys(SETTING_RULES), ...Object.keys(LIMIT_SETTING_RULES)]);
    const owned = new Map(
        [...tools].map((tool) => [
            tool,
            new Map(Object.entries({ ...LIMIT_SETTING_RULES[tool], ...SETTING_RULES[tool] })),
        ]),
    );
    return listSettingsTables(settings)
        .flatMap((written) => listRuleTables(written))
        .flatMap(({ tool, rules, path }) => {
            if (rules === undefined) return [];
            return Object.keys(rules).flatMap((rule) => {
                const setting = owned.get(tool)?.get(rule);
                if (setting === undefined) return [];
                const message =
                    setting === '[[import_rule]]'
                        ? `gspot writes the options of ${rule} from the [[import_rule]] records. Change those records instead.`
                        : `gspot writes the options of ${rule} from ${setting}. Change that setting instead: gspot set ${setting} <value>, with --reason when you raise it.`;
                return [{ path: [...path, rule], message }];
            });
        });
}

/**
Require a reason when a Swift target lowers the coverage minimum.

@param settings the parsed settings.
@param availableSettings the selected configuration settings and defaults.
*/
export function validateSwiftTargets(settings: Settings, availableSettings: AvailableSettings): SettingsError[] {
    const coverageLines = getSettingValue(availableSettings, settings, COVERAGE_LINES_SETTING, '')?.value;
    return (settings.coverage?.swift_target ?? [])
        .map((target, index) => ({ target, index }))
        .filter(
            ({ target }) =>
                typeof coverageLines === 'number' &&
                target.min_line_percent < coverageLines &&
                target.reason === undefined,
        )
        .map(({ index }) => ({
            path: ['coverage', 'swift_target', index, 'reason'],
            message: SWIFT_TARGET_MESSAGE,
        }));
}

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { FIRST_READ } from '#cli/config/settings/validation.ts';
import { LINK_REFUSAL } from '#cli/config/system.ts';
import { listRuleFiles, readConfigurations } from '#cli/manifests/read.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { isRuleFileExcluded, joinScopeSelector } from '#cli/settings/paths.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { formatCodeList, formatSimilarNames } from '#cli/system/text.ts';
import type { KeyPath } from '#cli/types/parsers.ts';
import type { Settings, SettingsError } from '#cli/types/settings.ts';
import type { Files } from '#cli/types/system.ts';

function readPathStats(files: Files, path: string): ReturnType<Files['findStats']> | Error {
    try {
        const stats = files.findStats(path);
        return stats?.isSymbolicLink() === true ? new Error(`${path} ${LINK_REFUSAL}`) : stats;
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        return error;
    }
}

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

export function validateRuleFilePaths(root: string, settings: Settings): SettingsError[] {
    const files = openFiles(root);
    return listSettingsTables(settings).flatMap(({ table, scopePath, path }) => {
        const ruleFiles = table.security?.semgrep_rules;
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
                key: 'semgrep_rules',
                path: [...path, 'security', 'semgrep_rules', index],
            })),
        ];
        return paths.flatMap(({ value, key, path }) => {
            const stats = readPathStats(files, joinScopeSelector(value, scopePath));
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

export function validateRuleExcludes(exclude: string[]): SettingsError[] {
    if (exclude.length === 0) return [];
    const paths = readConfigurations()
        .values()
        .flatMap((configuration) => listRuleFiles(configuration).map((file) => file.path))
        .toArray();
    return exclude.flatMap((excluded, index) => {
        const location: KeyPath = ['rule_files', 'exclude', index];
        const hasFirstRead = FIRST_READ.some((file) => isRuleFileExcluded(file, excluded));
        if (hasFirstRead)
            return [
                {
                    path: location,
                    message: `[rule_files] exclude names ${formatCodeList([excluded])}, which holds a file every agent opens first (${formatCodeList(FIRST_READ)}). Remove the entry.`,
                },
            ];
        const isRuleMatch = paths.some((path) => isRuleFileExcluded(path, excluded));
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

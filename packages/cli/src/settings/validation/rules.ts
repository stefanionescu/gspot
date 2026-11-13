import { SETTING_RULES } from '#cli/config/settings/validation.ts';
import { LIMIT_SETTING_RULES } from '#cli/manifests/limits.ts';
import { listSettingsTables } from '#cli/settings/values/written.ts';
import type { Settings, SettingsError, WrittenScopeTable } from '#cli/types/settings.ts';

function listRuleTables({ table, path }: WrittenScopeTable) {
    const eslint = table.tools?.eslint;
    const overrides = eslint !== undefined && 'override' in eslint ? eslint.override : undefined;
    return [
        { tool: 'eslint', rules: eslint?.rules, path: [...path, 'tools', 'eslint', 'rules'] },
        {
            tool: 'markdownlint',
            rules: table.tools?.markdownlint?.rules,
            path: [...path, 'tools', 'markdownlint', 'rules'],
        },
        ...(overrides ?? []).map((override, index) => ({
            tool: 'eslint',
            rules: override.rules,
            path: [...path, 'tools', 'eslint', 'override', index, 'rules'],
        })),
    ];
}

export function findRuleSetting(tool: string, rule: string): string | undefined {
    const owned = { ...LIMIT_SETTING_RULES[tool], ...SETTING_RULES[tool] };
    return Object.hasOwn(owned, rule) ? owned[rule] : undefined;
}

export function validateSettingRules(settings: Settings): SettingsError[] {
    return listSettingsTables(settings)
        .flatMap((written) => listRuleTables(written))
        .flatMap(({ tool, rules, path }) => {
            if (rules === undefined) return [];
            return Object.keys(rules).flatMap((rule) => {
                const setting = findRuleSetting(tool, rule);
                if (setting === undefined) return [];
                const message = `gspot writes the options of ${rule} from ${setting}. Change that setting instead: gspot set ${setting} <value>, with --reason when you raise it.`;
                return [{ path: [...path, rule], message }];
            });
        });
}

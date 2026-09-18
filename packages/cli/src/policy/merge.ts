// The merged view a renderer reads for one scope: every setting resolved, limits and naming by language, tool slots by tool.
import { listSettings, resolveSetting } from '#cli/policy/settings.ts';
import type { SettingsSurface } from '#cli/policy/settings.ts';
import type { FormatConfig, IgnoreEntry, Policy } from '#types/config.ts';
import type { Manifest } from '#types/manifest.ts';

export type MergedView = {
    scope: string;
    presets: string[];
    settings: Record<string, unknown>;
    reasons: Record<string, string>;
    format: FormatConfig;
    limit: (key: string, language?: string) => number | undefined;
    tool: (name: string) => Record<string, unknown>;
    toolEnabled: (name: string) => boolean;
    ignoresFor: (check: string) => IgnoreEntry[];
    rulesOff: (check: string) => string[];
    extra: (name: string) => Record<string, unknown> | undefined;
};

const FORMAT_DEFAULTS: FormatConfig = {
    indent_style: 'space',
    indent_width: 4,
    print_width: 120,
    line_ending: 'lf',
    final_newline: true,
    quotes: 'single',
    trailing_comma: 'all',
    semicolons: true,
};

/** Builds the merged view for a scope from the surface, the policy and the scope's selection. */
export function mergeForScope(
    surface: SettingsSurface,
    policy: Policy,
    selected: Manifest[],
    scope: string,
): MergedView {
    const settings: Record<string, unknown> = {};
    const reasons: Record<string, string> = {};
    for (const row of listSettings(surface, policy, scope)) {
        settings[row.key] = row.value;
        if (row.reason !== undefined) reasons[row.key] = row.reason;
    }
    const scopeTable = policy.scopeTables[scope];
    const format: FormatConfig = {
        ...FORMAT_DEFAULTS,
        ...policy.format,
        ...(scopeTable?.format ?? {}),
    } as FormatConfig;
    const limit = (key: string, language?: string): number | undefined => {
        if (language) {
            const scoped = resolveSetting(surface, policy, `limits.${language}.${key}`, scope);
            if (
                scoped &&
                scoped.source !== 'unset' &&
                scoped.value !== undefined &&
                scoped.source.includes(`limits.${language}.${key}`)
            )
                return scoped.value as number;
            const grouped =
                policy.scopeTables[scope]?.limits?.groups[language]?.[key] ?? policy.limits.groups[language]?.[key];
            if (grouped) return grouped.value;
            const groupDefault = surface.defaults.get(`limits.${language}.${key}`);
            if (groupDefault) return groupDefault.value as number;
        }
        const root = resolveSetting(surface, policy, `limits.${key}`, scope);
        return root?.value as number | undefined;
    };
    const toolTables = (name: string): Record<string, unknown>[] => [
        policy.tools[name] ?? {},
        scopeTable?.tools?.[name] ?? {},
    ];
    const tool = (name: string): Record<string, unknown> => {
        const merged: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(settings))
            if (key.startsWith(`tools.${name}.`)) merged[key.slice(name.length + 7)] = value;
        for (const table of toolTables(name))
            for (const [slot, value] of Object.entries(table))
                if (slot !== 'extra' && slot !== 'enabled' && merged[slot] === undefined) merged[slot] = value;
        return merged;
    };
    const toolEnabled = (name: string): boolean => {
        const resolved = resolveSetting(surface, policy, `tools.${name}.enabled`, scope);
        return resolved?.value !== false;
    };
    const ignoresFor = (check: string): IgnoreEntry[] => policy.ignores.filter((entry) => entry.check === check);
    const rulesOff = (check: string): string[] =>
        ignoresFor(check)
            .filter((entry) => entry.rule !== undefined && (entry.paths === undefined || entry.paths.length === 0))
            .map((entry) => entry.rule!);
    const extra = (name: string): Record<string, unknown> | undefined => {
        const tables = toolTables(name);
        const found = tables
            .map((table) => table['extra'])
            .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null);
        if (found.length === 0) return undefined;
        return Object.assign({}, ...found) as Record<string, unknown>;
    };
    return {
        scope,
        presets: selected.map((manifest) => manifest.preset.id),
        settings,
        reasons,
        format,
        limit,
        tool,
        toolEnabled,
        ignoresFor,
        rulesOff,
        extra,
    };
}

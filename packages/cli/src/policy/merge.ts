// The merged view a renderer reads for one scope: every setting resolved, limits and naming by language, tool slots by tool.
import type { Manifest } from '#types/manifest.ts';
import { listSettings, settingValue } from '#cli/policy/settings.ts';

import type {
    MergedView,
    FormatSettings,
    IgnoreEntry,
    Policy,
    PolicyScopeLayer,
    SettingsSurface,
} from '#types/config.ts';

const FORMAT_DEFAULTS: FormatSettings = {
    indent_style: 'space',
    indent_width: 4,
    print_width: 120,
    line_ending: 'lf',
    newline_at_end: true,
    quotes: 'single',
    trailing_comma: 'all',
    semicolons: true,
};
const TOOL_PREFIX = 'tools.';
const RESERVED_SLOTS = new Set(['extra', 'enabled']);

function writtenLimit(layer: PolicyScopeLayer, name: string): number | undefined {
    const found = settingValue(layer.surface, layer.policy, name, layer.scope);
    if (found === undefined || found.source === 'unset' || !found.source.includes(name)) return undefined;
    return found.value as number | undefined;
}

function groupedLimit(policy: Policy, scope: string, key: string, language: string): number | undefined {
    const grouped = policy.scopeTables[scope]?.limits?.groups[language]?.[key] ?? policy.limits.groups[language]?.[key];
    return grouped?.value;
}

function languageLimit(layer: PolicyScopeLayer, key: string, language: string): number | undefined {
    const name = `limits.${language}.${key}`;
    return (
        writtenLimit(layer, name) ??
        groupedLimit(layer.policy, layer.scope, key, language) ??
        (layer.surface.defaults.get(name)?.value as number | undefined)
    );
}

function limitOf(layer: PolicyScopeLayer, key: string, language?: string): number | undefined {
    const perLanguage = language === undefined ? undefined : languageLimit(layer, key, language);
    if (perLanguage !== undefined) return perLanguage;
    return settingValue(layer.surface, layer.policy, `limits.${key}`, layer.scope)?.value as number | undefined;
}

function toolTables(policy: Policy, scope: string, name: string): Record<string, unknown>[] {
    return [policy.tools[name] ?? {}, policy.scopeTables[scope]?.tools?.[name] ?? {}];
}

function settingSlots(settings: Record<string, unknown>, name: string): Record<string, unknown> {
    const prefix = `${TOOL_PREFIX}${name}.`;
    const merged: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(settings))
        if (key.startsWith(prefix)) merged[key.slice(prefix.length)] = value;
    return merged;
}

function toolSlots(
    settings: Record<string, unknown>,
    tables: Record<string, unknown>[],
    name: string,
): Record<string, unknown> {
    const merged = settingSlots(settings, name);
    for (const table of tables)
        for (const [slot, value] of Object.entries(table))
            if (!RESERVED_SLOTS.has(slot) && merged[slot] === undefined) merged[slot] = value;
    return merged;
}

function extraOf(tables: Record<string, unknown>[]): Record<string, unknown> | undefined {
    const found = tables
        .map((table) => table['extra'])
        .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null);
    return found.length === 0 ? undefined : (Object.assign({}, ...found) as Record<string, unknown>);
}

/**
 * Builds the merged view for a scope from the surface, the policy and the scope's selection.
 * @param surface the surface of the selection
 * @param policy the policy
 * @param selected the selected manifests
 * @param scope the scope path, '' for the root
 * @returns the view the templates read
 */
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
    const layer: PolicyScopeLayer = { surface, policy, scope };
    const ignoresFor = (check: string): IgnoreEntry[] => policy.ignores.filter((entry) => entry.check === check);
    return {
        scope,
        presets: selected.map((manifest) => manifest.preset.id),
        settings,
        reasons,
        format: { ...FORMAT_DEFAULTS, ...policy.format, ...policy.scopeTables[scope]?.format },
        limit: (key, language) => limitOf(layer, key, language),
        tool: (name) => toolSlots(settings, toolTables(policy, scope, name), name),
        toolEnabled: (name) => settingValue(surface, policy, `tools.${name}.enabled`, scope)?.value !== false,
        ignoresFor,
        rulesOff: (check) =>
            ignoresFor(check)
                .filter((entry) => entry.paths === undefined || entry.paths.length === 0)
                .map((entry) => entry.rule)
                .filter((rule) => rule !== undefined),
        extra: (name) => extraOf(toolTables(policy, scope, name)),
    };
}

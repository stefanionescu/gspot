// A literal directory followed by /** covers that complete scope and each descendant.

import type { Manifest } from '#cli/types/kits.ts';
import { shippedFormat } from '#cli/kits/listing.ts';
import { TOOL_PREFIX, RESERVED_SLOTS } from '#cli/config/policy/policy.ts';
import { listSettings, policyTables, settingValue } from '#cli/policy/settings.ts';

import type {
    Policy,
    MergedView,
    IgnoreEntry,
    FormatSettings,
    ExposedSettings,
    PolicyScopeLayer,
} from '#cli/types/policy/policy.ts';

// Partial selectors and selectors with exclusions must remain per-file filters.
function coversScope(paths: string[], scope: string): boolean {
    if (scope === '' || paths.some((path) => path.startsWith('!'))) return false;
    const segments = scope.split('/');
    return segments.some((_, index) => {
        const literal = segments
            .slice(0, index + 1)
            .join('/')
            .replaceAll(/[?*[\]{}]/gu, String.raw`\$&`);
        return paths.includes(`${literal}/**`);
    });
}

function limitOf(layer: PolicyScopeLayer, key: string, language?: string): number | undefined {
    if (language !== undefined) {
        const grouped = policyTables(layer.policy, layer.scope)
            .toReversed()
            .map(({ table }) => table.limits?.groups[language]?.[key])
            .find((value) => value !== undefined);
        const perLanguage = grouped?.value ?? layer.surface.defaults.get(`limits.${language}.${key}`)?.value;
        if (perLanguage !== undefined) return perLanguage as number;
    }
    return settingValue(layer.surface, layer.policy, `limits.${key}`, layer.scope)?.value as number | undefined;
}

function settingSlots(settings: Record<string, unknown>, name: string): Record<string, unknown> {
    const prefix = `${TOOL_PREFIX}${name}.`;
    const merged: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(settings)) {
        if (!key.startsWith(prefix)) continue;
        const segments = key.slice(prefix.length).split('.');
        let table = merged;
        for (const [index, segment] of segments.entries()) {
            if (index === segments.length - 1) {
                table[segment] = value;
                continue;
            }
            table[segment] ??= {};
            table = table[segment] as Record<string, unknown>;
        }
    }
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

/**
 * Builds the merged view for a scope from the surface, the policy and the scope's selection.
 * @param surface the surface of the selection
 * @param policy the policy
 * @param selected the selected manifests
 * @param scope the scope path, '' for the root
 * @returns the view the templates read
 */
export function mergeForScope(
    surface: ExposedSettings,
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
    const format = shippedFormat() as FormatSettings;
    for (const { table } of policyTables(policy, scope)) Object.assign(format, table.format ?? {});
    return {
        scope,
        configurations: selected.map((manifest) => manifest.configuration.name),
        settings,
        reasons,
        format,
        limit: (key, language) => limitOf(layer, key, language),
        tool: (name) =>
            toolSlots(
                settings,
                policyTables(policy, scope).map(({ table }) => table.tools?.[name] ?? {}),
                name,
            ),
        ignoresFor: (check: string): IgnoreEntry[] => policy.ignores.filter((entry) => entry.check === check),
        rulesOff: (check) =>
            policy.ignores
                .filter((entry) => entry.check === check)
                .filter(
                    (entry) => entry.paths === undefined || entry.paths.length === 0 || coversScope(entry.paths, scope),
                )
                .map((entry) => entry.rule)
                .filter((rule) => rule !== undefined),
        extra: (name) => {
            const found = policyTables(policy, scope)
                .map(({ table }) => table.tools?.[name] ?? {})
                .map((table) => table['extra'])
                .filter((value): value is Record<string, unknown> => typeof value === 'object');
            return found.length === 0 ? undefined : (Object.assign({}, ...found) as Record<string, unknown>);
        },
    };
}

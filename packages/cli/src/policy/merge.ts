import { shippedFormat } from '#cli/configurations/listing.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';
import type { ExposedSettings, PolicyScopeLayer } from '#cli/policy/settings.ts';
import { listSettings, policyTables, settingValue } from '#cli/policy/settings.ts';
import type { FormatSettings, IgnoreEntry, Policy } from '#cli/policy/normalize.ts';

const TOOL_PREFIX = 'tools.';
const RESERVED_SLOTS = new Set(['extra']);

// A literal directory followed by /** covers that complete scope and each descendant.
// Partial selectors and selectors with exclusions must remain per-file filters.
function coversScope(paths: string[], scope: string): boolean {
    if (scope === '' || paths.some((path) => path.startsWith('!'))) return false;
    const segments = scope.split('/');
    return segments.some((_, index) =>
        paths.includes(
            `${segments
                .slice(0, index + 1)
                .join('/')
                .replaceAll(/[?*[\]{}]/gu, String.raw`\$&`)}/**`,
        ),
    );
}

function groupedLimit(policy: Policy, scope: string, key: string, language: string): number | undefined {
    const grouped = policyTables(policy, scope)
        .toReversed()
        .map(({ table }) => table.limits?.groups[language]?.[key])
        .find((value) => value !== undefined);
    return grouped?.value;
}

function languageLimit(layer: PolicyScopeLayer, key: string, language: string): number | undefined {
    const name = `limits.${language}.${key}`;
    return (
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
    return policyTables(policy, scope).map(({ table }) => table.tools?.[name] ?? {});
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
    const ignoresFor = (check: string): IgnoreEntry[] => policy.ignores.filter((entry) => entry.check === check);
    return {
        scope,
        configurations: selected.map((manifest) => manifest.configuration.name),
        settings,
        reasons,
        format: Object.assign(
            shippedFormat() as FormatSettings,
            ...policyTables(policy, scope).map(({ table }) => table.format ?? {}),
        ),
        limit: (key, language) => limitOf(layer, key, language),
        tool: (name) => toolSlots(settings, toolTables(policy, scope, name), name),
        ignoresFor,
        rulesOff: (check) =>
            ignoresFor(check)
                .filter(
                    (entry) => entry.paths === undefined || entry.paths.length === 0 || coversScope(entry.paths, scope),
                )
                .map((entry) => entry.rule)
                .filter((rule) => rule !== undefined),
        extra: (name) => extraOf(toolTables(policy, scope, name)),
    };
}

export type MergedView = {
    scope: string;
    configurations: string[];
    settings: Record<string, unknown>;
    reasons: Record<string, string>;
    format: FormatSettings;
    limit: (key: string, language?: string) => number | undefined;
    tool: (name: string) => Record<string, unknown>;
    ignoresFor: (check: string) => IgnoreEntry[];
    rulesOff: (check: string) => string[];
    extra: (name: string) => Record<string, unknown> | undefined;
};

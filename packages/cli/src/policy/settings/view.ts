import { coversScope } from '#cli/repository/selectors.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { ISO_DATE_LENGTH } from '#cli/config/policy/settings.ts';
import { tablesFor, listSettings, settingValue } from '#cli/policy/settings/lookup.ts';

import type {
    Policy,
    ScopeView,
    IgnoreEntry,
    KnownSettings,
    FormatSettings,
    ScopeSelection,
} from '#cli/types/policy/settings.ts';

function settingSlots(settings: Record<string, unknown>, name: string): Record<string, unknown> {
    const prefix = `${name}.`;
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

function optionSlots(
    settings: Record<string, unknown>,
    tables: Record<string, unknown>[],
    name: string,
): Record<string, unknown> {
    const merged = settingSlots(settings, name);
    for (const table of tables)
        for (const [slot, value] of Object.entries(table))
            if (slot !== 'verbatim' && merged[slot] === undefined) merged[slot] = value;
    return merged;
}

/**
 * Select saved ignores whose expiry date has not arrived.
 * @param policy the repository policy, including inactive ignores
 * @returns the ignores that apply today in UTC
 */
export function activeIgnores(policy: Policy): IgnoreEntry[] {
    const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
    return policy.ignores.filter((entry) => entry.until === undefined || today < entry.until);
}

/**
 * Builds the merged view for a scope from the surface, the policy and the scope's selection.
 * @param surface the surface of the selection
 * @param policy the policy
 * @param selected the selected manifests
 * @param scope the scope path, '' for the root
 * @returns the view the templates read
 */
export function scopeView(surface: KnownSettings, policy: Policy, selected: Manifest[], scope: string): ScopeView {
    const settings: Record<string, unknown> = {};
    for (const row of listSettings(surface, policy, scope)) {
        settings[row.key] = row.value;
    }
    const ignores = activeIgnores(policy);
    const format = settingSlots(settings, 'format') as FormatSettings;
    return {
        configurations: selected.map((manifest) => manifest.configuration.name),
        settings,
        format,
        limit: (key, language) => {
            const perLanguage =
                language === undefined
                    ? undefined
                    : settingValue(surface, policy, `limits.${language}.${key}`, scope)?.value;
            return (perLanguage ?? settingValue(surface, policy, `limits.${key}`, scope)?.value) as number | undefined;
        },
        options: (name) =>
            optionSlots(
                settings,
                tablesFor(policy, scope).flatMap(({ table }) => {
                    const options = name.startsWith('tools.')
                        ? table.tools?.[name.slice('tools.'.length)]
                        : table.configurationSettings?.[name];
                    return options === undefined ? [] : [options];
                }),
                name,
            ),
        ignoresFor: (check: string): IgnoreEntry[] => ignores.filter((entry) => entry.check === check),
        rulesOff: (check) =>
            ignores
                .filter((entry) => entry.check === check)
                .filter(
                    (entry) => entry.paths === undefined || entry.paths.length === 0 || coversScope(entry.paths, scope),
                )
                .map((entry) => entry.rule)
                .filter((rule) => rule !== undefined),
        verbatim: (name) => {
            const found = tablesFor(policy, scope)
                .map(({ table }) => table.tools?.[name]?.['verbatim'])
                .filter((value): value is Record<string, unknown> => typeof value === 'object');
            if (found.length === 0) return undefined;
            const options = Object.assign({}, ...found) as Record<string, unknown>;
            return Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'reason'));
        },
    };
}

/**
 * Read the merged policy settings of the repository root.
 * @param scopes the command's validated scope selections
 * @returns the root scope's merged view
 */
export function rootView(scopes: ScopeSelection[]): ScopeView {
    const root = scopes.find((selection) => selection.scope.path === '');
    if (root === undefined) throw new Error('The session has no root scope.');
    return root.view;
}

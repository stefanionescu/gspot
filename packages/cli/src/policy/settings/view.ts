import { coversScope } from '#cli/repository/selectors.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { ISO_DATE_LENGTH } from '#cli/config/policy/settings.ts';
import { tablesFor, effectiveSettings } from '#cli/policy/settings/lookup.ts';
import type { Policy, ScopeView, IgnoreEntry, KnownSettings, ScopeSelection } from '#cli/types/policy/settings.ts';

/**
 * Select saved ignores whose expiry date has not arrived.
 * @param policy the repository policy, including inactive ignores
 * @returns the ignores that apply today in UTC
 */
export function activeIgnores(policy: Policy): IgnoreEntry[] {
    const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
    return policy.ignore.filter((entry) => entry.until === undefined || today < entry.until.toISOString());
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
    const { settings, values, limits, test_files: testFiles } = effectiveSettings(surface, policy, selected, scope);
    const ignores = activeIgnores(policy).map((entry) => ({ ...entry, paths: entry.paths ?? [] }));
    const format = values.format;
    if (format === undefined) throw new Error('The selected scope has no format settings.');
    return {
        configurations: selected.map((manifest) => manifest.configuration.name),
        test_files: testFiles,
        settings,
        values,
        roles: { ...values.architecture?.roles, tests: values.architecture?.roles.tests ?? testFiles },
        format,
        limit: (key, language) => limits[`${language ?? ''}.${key}`] ?? limits[`.${key}`],
        options: (name) => {
            const value = values[name];
            if (value === undefined) throw new Error(`The selected scope has no ${name} settings.`);
            return value;
        },
        ignoresFor: (check) => ignores.filter((entry) => entry.check === check),
        rulesOff: (check) =>
            ignores
                .filter((entry) => entry.check === check)
                .filter((entry) => entry.paths.length === 0 || coversScope(entry.paths, scope))
                .map((entry) => entry.rule)
                .filter((rule) => rule !== undefined),
        verbatim: (name) => {
            const found = tablesFor(policy, scope)
                .map(({ table }) => table.tools?.[name]?.['verbatim'])
                .filter((value): value is Record<string, unknown> => typeof value === 'object');
            if (found.length === 0) return undefined;
            return Object.fromEntries(found.flatMap((value) => Object.entries(value)));
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

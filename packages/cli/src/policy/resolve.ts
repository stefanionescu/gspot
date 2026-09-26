import { mergeForScope } from '#cli/policy/merge.ts';
import type { MergedView } from '#cli/policy/merge.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import { exposedSettings } from '#cli/policy/settings.ts';
import type { ScopeEntry } from '#cli/repository/scopes.ts';
import type { ExposedSettings } from '#cli/policy/settings.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';

/**
 * Resolves every scope: its selected configurations, settings surface, and merged view.
 * @param policy the repository policy
 * @param scopes the scopes of the repository
 * @param manifests every manifest by name
 * @returns one selection per scope, in the given order
 */
export function resolveScopes(
    policy: Policy,
    scopes: ScopeEntry[],
    manifests: Map<string, Manifest>,
): ScopeSelection[] {
    return scopes.map((scope) => {
        const selected = selectForScope(policy, scope.path, manifests);
        const surface = exposedSettings(selected);
        const view = mergeForScope(surface, policy, selected, scope.path);
        return { scope, selected, surface, view };
    });
}

export type ScopeSelection = {
    scope: ScopeEntry;
    selected: Manifest[];
    surface: ExposedSettings;
    view: MergedView;
};

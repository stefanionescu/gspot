import type { Manifest } from '#cli/configurations/manifests.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import type { MergedView } from '#cli/policy/merge.ts';
import { mergeForScope } from '#cli/policy/merge.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import type { ExposedSettings } from '#cli/policy/settings.ts';
import { exposedSettings } from '#cli/policy/settings.ts';
import type { ScopeEntry } from '#cli/repository/scopes.ts';

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

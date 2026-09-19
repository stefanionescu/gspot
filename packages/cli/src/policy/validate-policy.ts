// The whole validation a read performs: schema, structural rules, then the selection and the settings surface.
import type { Policy } from '#types/config.ts';
import { selectForScope } from '#cli/presets/select.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import { excludeProblems } from '#cli/rules/assemble.ts';
import { exposedSettings } from '#cli/policy/settings.ts';
import { validateAgainstSurface } from '#cli/policy/audit.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';

/**
 * Every problem the selection and the surface find in a parsed policy. Throws PolicyError when there are any.
 * @param policy the parsed policy
 */
export function assertPolicyComplete(policy: Policy): void {
    const manifests = presetManifests();
    const problems: string[] = [];
    const rootSelected = selectForScope(policy.presets, [], manifests);
    // A scope table is read against the settings of the presets that scope selects, the root presets included.
    const scopeSurfaces = new Map(
        policy.scopes.map((scope) => [
            scope.path,
            exposedSettings(selectForScope(policy.presets, scope.presets, manifests)),
        ]),
    );
    problems.push(
        ...excludeProblems(policy.rules.exclude),
        ...validateAgainstSurface(exposedSettings(rootSelected), policy, scopeSurfaces),
    );
    if (problems.length > 0) throw new PolicyError([...new Set(problems)]);
}

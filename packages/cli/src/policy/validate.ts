// The whole validation a load performs: schema, structural rules, then the selection and the settings surface.
import { PolicyError } from '#cli/policy/load.ts';
import { buildSurface, validateAgainstSurface } from '#cli/policy/settings.ts';
import { loadManifests } from '#cli/presets/load.ts';
import { selectForScope } from '#cli/presets/select.ts';
import type { Policy } from '#types/config.ts';

/** Every problem the selection and the surface find in a parsed policy. Throws PolicyError when there are any. */
export function assertPolicyComplete(policy: Policy): void {
    const manifests = loadManifests();
    const problems: string[] = [];
    const rootSelected = selectForScope(policy.presets, [], manifests);
    problems.push(...validateAgainstSurface(buildSurface(rootSelected), policy));
    for (const scope of policy.scopes) selectForScope(policy.presets, scope.presets, manifests);
    if (problems.length > 0) throw new PolicyError([...new Set(problems)]);
}

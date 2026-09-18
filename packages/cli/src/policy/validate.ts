// The whole validation a read performs: schema, structural rules, then the selection and the settings surface.
import type { Policy } from '#types/config.ts';
import { PolicyError } from '#cli/policy/read.ts';
import { buildSurface } from '#cli/policy/settings.ts';
import { presetManifests } from '#cli/presets/read.ts';
import { selectForScope } from '#cli/presets/select.ts';
import { validateAgainstSurface } from '#cli/policy/audit.ts';

/**
 * Every problem the selection and the surface find in a parsed policy. Throws PolicyError when there are any.
 * @param policy the parsed policy
 */
export function assertPolicyComplete(policy: Policy): void {
    const manifests = presetManifests();
    const problems: string[] = [];
    const rootSelected = selectForScope(policy.presets, [], manifests);
    problems.push(...validateAgainstSurface(buildSurface(rootSelected), policy));
    for (const scope of policy.scopes) selectForScope(policy.presets, scope.presets, manifests);
    if (problems.length > 0) throw new PolicyError([...new Set(problems)]);
}

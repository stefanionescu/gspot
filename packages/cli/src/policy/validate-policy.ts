import { nearMatches } from '#cli/policy/near.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import { excludeProblems } from '#cli/agents/assemble.ts';
import { exposedSettings } from '#cli/policy/settings.ts';
import type { PolicyFiles } from '#cli/policy/read-policy.ts';
import { validateAgainstSurface } from '#cli/policy/audit.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { unknownConfiguration } from '#cli/policy/messages.ts';
import type { PathSegment, PolicyProblem } from '#cli/policy/problems.ts';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';
import { sourceLocations, policyLocation } from '#cli/policy/source-locations.ts';

/**
 * Every problem the selection and the surface find in a parsed policy. Throws PolicyError when there are any.
 * @param source the parsed policy and its authored text
 */
export function assertPolicyComplete(source: PolicyFiles): void {
    const { policy } = source;
    const manifests = configurationManifests();
    const declarations: { name: string; path: PathSegment[] }[] = [
        ...policy.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...policy.scopes.flatMap((scope, scopeIndex) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', scopeIndex, 'configurations', index] })),
        ),
    ];
    const unknown = declarations.filter(({ name }) => !manifests.has(name));
    if (unknown.length > 0) {
        const locations = sourceLocations(source.text);
        throw new PolicyError(
            unknown.map(
                ({ name, path }) =>
                    `${source.path}:${policyLocation(locations, path)}: ${unknownConfiguration(name, nearMatches(name, [...manifests.keys()]))}`,
            ),
        );
    }
    const problems: PolicyProblem[] = [];
    const rootSelected = selectForScope(policy, '', manifests);
    // A scope table is read against the settings of the configurations that scope selects, the root configurations included.
    const scopeSurfaces = new Map(
        policy.scopes.map((scope) => [scope.path, exposedSettings(selectForScope(policy, scope.path, manifests))]),
    );
    const selectedNames = new Set(
        [...rootSelected, ...policy.scopes.flatMap((scope) => selectForScope(policy, scope.path, manifests))].flatMap(
            (manifest) => manifest.checks.map((check) => check.name),
        ),
    );
    for (const [index, name] of policy.extraChecks.entries())
        if (!selectedNames.has(name))
            problems.push({
                path: ['extra_checks', index],
                message: `extra_checks names an unselected or unknown check: ${name}.`,
            });
    problems.push(
        ...policy.rules.exclude.flatMap((entry, index) =>
            excludeProblems([entry]).map((message) => ({ path: ['rules', 'exclude', index], message })),
        ),
        ...validateAgainstSurface(exposedSettings(rootSelected), policy, scopeSurfaces),
    );
    if (problems.length > 0) {
        const locations = sourceLocations(source.text);
        throw new PolicyError([
            ...new Set(
                problems.map(
                    (problem) => `${source.path}:${policyLocation(locations, problem.path)}: ${problem.message}`,
                ),
            ),
        ]);
    }
}

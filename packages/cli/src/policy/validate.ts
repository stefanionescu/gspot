import { nearMatches } from '#cli/policy/near.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import { excludeProblems } from '#cli/agents/assemble.ts';
import { validateAgainstSurface } from '#cli/policy/audit.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { unknownConfiguration } from '#cli/policy/messages.ts';
import { exposedSettings } from '#cli/policy/setting-surface.ts';
import type { PathSegment, PolicyProblem } from '#cli/policy/problems.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

/**
 * The configuration names a policy selects that no manifest defines, each at its declaration.
 * @param policy the parsed policy
 * @returns one problem per unknown name
 */
export function unknownConfigurationProblems(policy: Policy): PolicyProblem[] {
    const manifests = configurationManifests();
    const declarations: { name: string; path: PathSegment[] }[] = [
        ...policy.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...policy.scopes.flatMap((scope, scopeIndex) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', scopeIndex, 'configurations', index] })),
        ),
    ];
    return declarations
        .filter(({ name }) => !manifests.has(name))
        .map(({ name, path }) => ({
            path,
            message: unknownConfiguration(name, nearMatches(name, [...manifests.keys()])),
        }));
}

/**
 * Every problem the selection and the surface find in a policy whose configuration names all exist.
 * @param policy the parsed policy
 * @returns the problems, each at the value that raised it
 */
export function completenessProblems(policy: Policy): PolicyProblem[] {
    const manifests = configurationManifests();
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
    return problems;
}

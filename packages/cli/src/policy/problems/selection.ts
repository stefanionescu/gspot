import { valueAt } from '#cli/platform/objects.ts';
import { excludeProblems } from '#cli/rules/assemble.ts';
import { everyTable } from '#cli/policy/settings/entries.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { validateAgainstSurface } from '#cli/policy/problems/keys.ts';
import { unknownConfigurations } from '#cli/configurations/problems.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { Policy, PolicyProblem } from '#cli/types/policy/settings.ts';
import type { ToolPin, ConfigurationDeclaration } from '#cli/types/configurations.ts';

// Native option constraints stay with the tool declarations, including those retained in an inactive scope.
function toolOptionProblems(table: Partial<Policy>, tools: ToolPin[]): PolicyProblem[] {
    const problems: PolicyProblem[] = [];
    for (const tool of tools) {
        const options = table.tools?.[tool.name]?.verbatim;
        if (options === undefined) continue;
        for (const restriction of tool.refused_options ?? []) {
            const refused = restriction.paths.some((path) => {
                const value = valueAt(options, path.split('.'));
                return (
                    value !== undefined &&
                    (restriction.values?.some((candidate) => Object.is(candidate, value)) ?? true)
                );
            });
            if (refused) problems.push({ path: ['tools', tool.name, 'verbatim'], message: restriction.message });
        }
    }
    return problems;
}

/**
 * The configuration names a policy selects that no manifest defines, each at its declaration.
 * @param policy the parsed policy
 * @returns one problem per unknown name
 */
export function unknownConfigurationProblems(policy: Policy): PolicyProblem[] {
    const manifests = configurationManifests();
    const declarations: ConfigurationDeclaration[] = [
        ...policy.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...policy.scopes.flatMap((scope, scopeIndex) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', scopeIndex, 'configurations', index] })),
        ),
    ];
    return unknownConfigurations(declarations, manifests).map(({ path, message: diagnostic }) => ({
        path,
        message: diagnostic,
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
    const tools = [...manifests.values()].flatMap((manifest) => manifest.tools);
    for (const { table, path } of everyTable(policy))
        problems.push(
            ...toolOptionProblems(table, tools).map((problem) => ({ ...problem, path: [...path, ...problem.path] })),
        );
    const rootSelected = selectForScope(policy, '', manifests);
    // A scope table is read against the settings of the configurations that scope selects, the root configurations included.
    const scopeSurfaces = new Map(
        policy.scopes.map((scope) => [
            scope.path,
            knownSettings(selectForScope(policy, scope.path, manifests), policy.level),
        ]),
    );
    problems.push(
        ...excludeProblems(policy.agentRules.exclude).map(({ index, message: diagnostic }) => ({
            path: ['agent_rules', 'exclude', index],
            message: diagnostic,
        })),
        ...validateAgainstSurface(
            knownSettings(rootSelected, policy.level),
            policy,
            scopeSurfaces,
            knownSettings([...manifests.values()], policy.level),
        ),
    );
    return problems;
}

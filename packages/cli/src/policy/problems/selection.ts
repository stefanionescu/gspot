import { isRecord } from '#cli/platform/objects.ts';
import { excludeProblems } from '#cli/rules/assemble.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { RUFF_PREVIEW_RULES } from '#cli/config/policy/settings.ts';
import { validateAgainstSurface } from '#cli/policy/problems/keys.ts';
import { unknownConfigurations } from '#cli/configurations/problems.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { everyTable, policyValue } from '#cli/policy/settings/entries.ts';
import type { Policy, PolicyProblem } from '#cli/types/policy/settings.ts';
import type { ConfigurationDeclaration } from '#cli/types/configurations.ts';

function ruffProblems(table: Partial<Policy>): PolicyProblem[] {
    const selected = policyValue(table, 'tools.ruff.select')?.value;
    const codes = Array.isArray(selected) ? selected : [];
    const verbatim = table.tools?.['ruff']?.verbatim ?? {};
    const lint = isRecord(verbatim['lint']) ? verbatim['lint'] : {};
    return [
        ...codes
            .filter((code): code is string => typeof code === 'string' && RUFF_PREVIEW_RULES.has(code))
            .map(
                (code): PolicyProblem => ({
                    path: ['tools', 'ruff', 'select'],
                    message: `gspot does not support Ruff preview rules. Remove ${code} from tools.ruff.select.`,
                }),
            ),
        ...[verbatim['select'], verbatim['extend-select'], lint['select'], lint['extend-select']]
            .filter(
                (value) =>
                    Array.isArray(value) &&
                    value.some((code) => typeof code === 'string' && RUFF_PREVIEW_RULES.has(code)),
            )
            .map(
                (): PolicyProblem => ({
                    path: ['tools', 'ruff', 'verbatim'],
                    message:
                        'gspot does not support Ruff preview rules. Remove preview rule codes from tools.ruff.verbatim.',
                }),
            ),
        ...([verbatim, lint, verbatim['format']].some((settings) => isRecord(settings) && settings['preview'] === true)
            ? [
                  {
                      path: ['tools', 'ruff', 'verbatim'],
                      message:
                          'gspot does not support Ruff preview rules. Remove preview = true from tools.ruff.verbatim.',
                  },
              ]
            : []),
    ];
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
    for (const { table, path } of everyTable(policy)) {
        problems.push(...ruffProblems(table).map((problem) => ({ ...problem, path: [...path, ...problem.path] })));
        if (table.tools?.['basedpyright']?.verbatim?.['enableExperimentalFeatures'] === true)
            problems.push({
                path: [...path, 'tools', 'basedpyright', 'verbatim'],
                message:
                    'gspot does not support experimental Basedpyright features. Remove enableExperimentalFeatures from tools.basedpyright.verbatim.',
            });
    }
    const rootSelected = selectForScope(policy, '', manifests);
    // A scope table is read against the settings of the configurations that scope selects, the root configurations included.
    const scopeSurfaces = new Map(
        policy.scopes.map((scope) => [
            scope.path,
            knownSettings(selectForScope(policy, scope.path, manifests), policy.level),
        ]),
    );
    const selectedNames = new Set(
        [...manifests.values()].flatMap((manifest) => manifest.checks.map((check) => check.name)),
    );
    for (const [index, name] of policy.extra_checks.entries())
        if (!selectedNames.has(name))
            problems.push({
                path: ['extra_checks', index],
                message: `extra_checks names ${name}, which no configuration ships. Remove it or use a check from gspot list checks.`,
            });
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

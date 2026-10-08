import { valueAt } from '#cli/platform/objects.ts';
import { similar, codeList } from '#cli/platform/text.ts';
import { FIRST_READ } from '#cli/config/policy/settings.ts';
import { everyTable } from '#cli/policy/settings/lookup.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { validateAgainstSurface } from '#cli/policy/errors/keys.ts';
import { unknownConfigurations } from '#cli/configurations/errors.ts';
import { architectureRolesSchema } from '#cli/policy/schema/fields.ts';
import { configurationFiles } from '#cli/configurations/declarations.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { ToolPin, ConfigurationDeclaration } from '#cli/types/configurations.ts';
import type { Policy, PolicyError, RuleExclusionError } from '#cli/types/policy/settings.ts';

// Native option constraints stay with the tool declarations, including those retained in an inactive scope.
function toolOptionErrors(table: Partial<Policy>, tools: ToolPin[]): PolicyError[] {
    const errors: PolicyError[] = [];
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
            if (refused) errors.push({ path: ['tools', tool.name, 'verbatim'], message: restriction.message });
        }
    }
    return errors;
}

/**
 * The configuration names a policy selects that no manifest defines, each at its declaration.
 * @param policy the parsed policy
 * @returns one error per unknown name
 */
export function unknownConfigurationErrors(policy: Policy): PolicyError[] {
    const manifests = configurationManifests();
    const declarations: ConfigurationDeclaration[] = [
        ...policy.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...Object.entries(policy.scope).flatMap(([path, scope]) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', path, 'configurations', index] })),
        ),
    ];
    return unknownConfigurations(declarations, manifests).map(({ path, message: diagnostic }) => ({
        path,
        message: diagnostic,
    }));
}

/**
 * Every error the selection and the surface find in a policy whose configuration names all exist.
 * @param policy the parsed policy
 * @returns the errors, each at the value that raised it
 */
export function completenessErrors(policy: Policy): PolicyError[] {
    const manifests = configurationManifests();
    const errors: PolicyError[] = [];
    const tools = [...manifests.values()].flatMap((manifest) => manifest.tools);
    for (const { table, path } of everyTable(policy))
        errors.push(...toolOptionErrors(table, tools).map((error) => ({ ...error, path: [...path, ...error.path] })));
    const rootSelected = selectForScope(policy, '', manifests);
    // A scope table is read against the settings of the configurations that scope selects, the root configurations included.
    const scopeSurfaces = new Map(
        Object.keys(policy.scope).map((scope) => [
            scope,
            knownSettings(selectForScope(policy, scope, manifests), policy.level),
        ]),
    );
    errors.push(
        ...everyTable(policy).flatMap(({ table, scope, path }) => {
            const selected =
                scope === undefined
                    ? [
                          rootSelected,
                          ...Object.keys(policy.scope).map((name) => selectForScope(policy, name, manifests)),
                      ].flat()
                    : selectForScope(policy, scope, manifests);
            const declarations = new Set(
                selected.flatMap((manifest) => manifest.settings.map((setting) => setting.name)),
            );
            return (table.architecture === undefined ? [] : Object.keys(table.architecture.roles))
                .filter(
                    (role) =>
                        !Object.hasOwn(architectureRolesSchema.shape, role) &&
                        !declarations.has(`architecture.roles.${role}`),
                )
                .map((role) => ({
                    path: [...path, 'architecture', 'roles', role],
                    message: `The ${role} architecture role is not declared by a selected configuration.`,
                }));
        }),
        ...excludeErrors(policy.agent_rules.exclude).map(({ index, message: diagnostic }) => ({
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
    return errors;
}

/**
 * Whether an exclusion names a rule file or an ancestor folder.
 * @param entry the authored exclusion.
 * @param path the rule path relative to its folder.
 * @returns whether the entry excludes the rule.
 */
export function isExcluded(entry: string, path: string): boolean {
    return path === entry || path.startsWith(`${entry.replace(/\/$/u, '')}/`);
}

/**
 * The errors in [agent_rules] exclude: an entry that matches no rule, and an entry that hides a file the reader opens first.
 * @param exclude the entries as written, relative to the rules folder
 * @returns each error with its position in the exclusion list
 */
export function excludeErrors(exclude: string[]): RuleExclusionError[] {
    if (exclude.length === 0) return [];
    const paths = [...configurationManifests().values()].flatMap((manifest) =>
        configurationFiles(manifest).map((file) => file.path),
    );
    return exclude.flatMap((entry, index) => {
        if (FIRST_READ.some((file) => isExcluded(entry, file)))
            return [
                {
                    index,
                    message: `[agent_rules] exclude names ${codeList([entry])}, which holds a file every agent opens first (${codeList(FIRST_READ)}). Remove the entry.`,
                },
            ];
        if (paths.some((path) => isExcluded(entry, path))) return [];
        const near = similar(entry, paths);
        const hint = near.length > 0 ? ` Did you mean ${codeList(near)}?` : '';
        return [{ index, message: `[agent_rules] exclude names ${codeList([entry])}, which matches no rule.${hint}` }];
    });
}

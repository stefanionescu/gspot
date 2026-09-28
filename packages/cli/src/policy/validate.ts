import { nearMatches } from '#cli/policy/near.ts';
import { selectForScope } from '#cli/kits/select.ts';
import { unknownKit } from '#cli/policy/messages.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { excludeProblems } from '#cli/agents/assemble.ts';
import { validateAgainstSurface } from '#cli/policy/audit.ts';
import { exposedSettings } from '#cli/policy/setting-surface.ts';
import { RUFF_PREVIEW_RULES } from '#cli/config/checks/ruff-rules.ts';
import { asRecord, policyValue, policyTables } from '#cli/policy/settings.ts';
import type { Policy, PathSegment, PolicyProblem } from '#cli/types/policy/policy.ts';

function ruffProblems(table: Partial<Policy>): PolicyProblem[] {
    const selected = policyValue(table, 'tools.ruff.select')?.value;
    const codes = Array.isArray(selected) ? selected : [];
    const extra = asRecord(table.tools?.['ruff']?.extra) ?? {};
    const lint = asRecord(extra['lint']) ?? {};
    const format = asRecord(extra['format']);
    return [
        ...codes
            .filter((code): code is string => typeof code === 'string' && RUFF_PREVIEW_RULES.has(code))
            .map(
                (code): PolicyProblem => ({
                    path: ['tools', 'ruff', 'select'],
                    message: `Ruff preview rule ${code} is unsupported at both levels.`,
                }),
            ),
        ...[extra['select'], extra['extend-select'], lint['select'], lint['extend-select']]
            .filter(
                (value) =>
                    Array.isArray(value) &&
                    value.some((code) => typeof code === 'string' && RUFF_PREVIEW_RULES.has(code)),
            )
            .map(
                (): PolicyProblem => ({
                    path: ['tools', 'ruff', 'extra'],
                    message: 'Explicit Ruff preview rule selection is unsupported at both levels.',
                }),
            ),
        ...([extra, lint, format].some((settings) => settings?.['preview'] === true)
            ? [
                  {
                      path: ['tools', 'ruff', 'extra'],
                      message: 'Ruff preview activation is unsupported at both levels.',
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
export function unknownKitProblems(policy: Policy): PolicyProblem[] {
    const manifests = kitManifests();
    const declarations: { name: string; path: PathSegment[] }[] = [
        ...policy.kits.map((name, index) => ({ name, path: ['kits', index] })),
        ...policy.scopes.flatMap((scope, scopeIndex) =>
            scope.kits.map((name, index) => ({ name, path: ['scope', scopeIndex, 'kits', index] })),
        ),
    ];
    return declarations
        .filter(({ name }) => !manifests.has(name))
        .map(({ name, path }) => ({
            path,
            message: unknownKit(name, nearMatches(name, [...manifests.keys()])),
        }));
}

/**
 * Every problem the selection and the surface find in a policy whose configuration names all exist.
 * @param policy the parsed policy
 * @returns the problems, each at the value that raised it
 */
export function completenessProblems(policy: Policy): PolicyProblem[] {
    const manifests = kitManifests();
    const problems: PolicyProblem[] = [];
    for (const { table } of [
        ...policyTables(policy, undefined),
        ...Object.entries(policy.scopeTables).map(([name, table]) => ({ name, table })),
    ]) {
        problems.push(...ruffProblems(table));
        if (table.tools?.['basedpyright']?.extra?.['enableExperimentalFeatures'] === true)
            problems.push({
                path: ['tools', 'basedpyright', 'extra'],
                message: 'Experimental Basedpyright features are unsupported at both levels.',
            });
    }
    const rootSelected = selectForScope(policy, '', manifests);
    // A scope table is read against the settings of the configurations that scope selects, the root kits included.
    const scopeSurfaces = new Map(
        policy.scopes.map((scope) => [
            scope.path,
            exposedSettings(selectForScope(policy, scope.path, manifests), policy.level),
        ]),
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
        ...policy.guides.exclude.flatMap((entry, index) =>
            excludeProblems([entry]).map((text) => ({ path: ['rules', 'exclude', index], message: text })),
        ),
        ...validateAgainstSurface(exposedSettings(rootSelected, policy.level), policy, scopeSurfaces),
    );
    return problems;
}

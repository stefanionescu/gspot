import { isDeepStrictEqual } from 'node:util';
import { settingPaths } from '#cli/policy/paths.ts';
import { policySchema } from '#cli/policy/schema/public.ts';
import { valueAt, isRecord } from '#cli/platform/contracts.ts';
import { defaultValue } from '#cli/policy/schema/contracts.ts';
import { knownSettings } from '#cli/policy/settings/public.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';
import { selectForScope } from '#cli/repository/selection/public.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import type { DefaultPolicyTable } from '#cli/types/policy/defaults.ts';
import { isInScope, byScopeDepth } from '#cli/repository/paths/public.ts';
import { mergeValue, declarationFor, settingCandidates } from '#cli/policy/settings/contracts.ts';

function configurationSelection(table: TomlTable) {
    return {
        configurations: policySchema.shape.configurations.parse(table['configurations']) ?? [],
        removed_configurations: policySchema.shape.removed_configurations.parse(table['removed_configurations']) ?? [],
    };
}

function effectiveValue(
    tables: DefaultPolicyTable[],
    key: string,
    consumer: DefaultPolicyTable,
    omitted?: string,
): unknown {
    const match = declarationFor(consumer.surface, key);
    if (match === undefined) return undefined;
    let value = settingPaths(
        match.declaration.name,
        consumer.surface.defaults.get(match.declaration.name)?.value,
        consumer.scope,
    );
    for (const layer of tables.filter(({ scope }) => isInScope(consumer.scope, scope))) {
        for (const candidate of settingCandidates(match, key)) {
            const written = valueAt(layer.table, candidate.split('.'));
            if (written === undefined || (layer.scope === omitted && candidate === key)) continue;
            value = mergeValue(match.declaration, value, settingPaths(candidate, written, layer.scope));
        }
    }
    return value;
}

function omitTableDefaults(
    table: TomlTable,
    owner: DefaultPolicyTable,
    tables: DefaultPolicyTable[],
    path: string[] = [],
): TomlTable {
    const entries = Object.entries(table).flatMap<[string, unknown]>(([name, value]) => {
        const segments = [...path, name];
        const key = segments.join('.');
        const declaration = declarationFor(owner.surface, key)?.declaration;
        if (declaration === undefined)
            return [[name, isRecord(value) ? omitTableDefaults(value, owner, tables, segments) : value]];
        // Project-derived defaults cannot prove that an authored command is redundant.
        if (declaration.name === 'site.build_command') return [[name, value]];
        // An authored empty path is a manual choice; omission permits project inference.
        if (declaration.type === 'path' && value === '') return [[name, value]];
        const consumers = tables.filter(({ scope }) => isInScope(scope, owner.scope));
        return consumers.every((consumer) =>
            isDeepStrictEqual(
                effectiveValue(tables, key, consumer),
                effectiveValue(tables, key, consumer, owner.scope),
            ),
        )
            ? []
            : [[name, value]];
    });
    const result = Object.fromEntries(
        entries.filter(
            ([, value]) =>
                !isRecord(value) || Object.keys(value).length > 0 || (path[0] === 'scope' && path.length === 1),
        ),
    );
    const reasons = result['reasons'];
    if (path.length === 0 && isRecord(reasons)) {
        const retained = Object.fromEntries(
            Object.entries(reasons).filter(([key]) => valueAt(result, key.split('.')) !== undefined),
        );
        result['reasons'] = retained;
        if (Object.keys(retained).length === 0) Reflect.deleteProperty(result, 'reasons');
    }
    return result;
}

/**
 * Omit redundant authored defaults without erasing a scope's override of its parent.
 * @param policy the independent canonical draft whose selected declarations own the defaults
 * @returns the draft without redundant setting values
 */
export function omitPolicyDefaults(policy: TomlTable): TomlTable {
    const manifests = configurationManifests();
    const level = defaultValue(policySchema.shape.level, policy['level']);
    const scopes = isRecord(policy['scope']) ? policy['scope'] : {};
    const selection = {
        ...configurationSelection(policy),
        scope: Object.fromEntries(
            Object.entries(scopes)
                .filter((entry): entry is [string, TomlTable] => isRecord(entry[1]))
                .map(([path, table]) => [path, configurationSelection(table)]),
        ),
    };
    const root = { scope: '', table: policy, surface: knownSettings(selectForScope(selection, '', manifests), level) };
    const tables = [
        root,
        ...Object.entries(scopes).flatMap<DefaultPolicyTable>(([scope, table]) =>
            isRecord(table)
                ? [{ scope, table, surface: knownSettings(selectForScope(selection, scope, manifests), level) }]
                : [],
        ),
    ].toSorted((left, right) => byScopeDepth(left.scope, right.scope));
    for (const owner of tables.filter(({ scope }) => scope !== ''))
        scopes[owner.scope] = omitTableDefaults(owner.table, owner, tables);
    return omitTableDefaults(policy, root, tables);
}

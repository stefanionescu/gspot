import { z } from 'zod';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import { settingValueSchemas } from '#cli/policy/schema/setting-values.ts';
import { scopeSchema, rootSettingSchemas } from '#cli/policy/schema/policy.ts';
import type { RawScope, PolicyPathCallback } from '#cli/types/policy/settings.ts';
import { valueAt, isRecord, createTable, normalizeTables } from '#cli/platform/objects.ts';

const settingSchemas = new Map<string, z.ZodType>(Object.entries({ ...rootSettingSchemas, ...settingValueSchemas }));

function tablePaths(schema: z.ZodType, value: unknown, visit: PolicyPathCallback, keys: KeyPath): unknown {
    if (schema instanceof z.ZodArray && Array.isArray(value))
        return value.map((entry: unknown, index) =>
            mapPolicyPaths(z.instanceof(z.ZodType).parse(schema.element), entry, visit, [...keys, index]),
        );
    if (!isRecord(value)) return value;
    if (schema instanceof z.ZodRecord) {
        const role = z.instanceof(z.ZodType).parse(schema.keyType).meta()?.pathRole;
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [
                role === undefined ? key : visit(key, [...keys, key], role),
                mapPolicyPaths(z.instanceof(z.ZodType).parse(schema.valueType), entry, visit, [...keys, key]),
            ]),
        );
    }
    if (schema instanceof z.ZodObject)
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => {
                const field: unknown = schema.shape[key];
                return [key, field instanceof z.ZodType ? mapPolicyPaths(field, entry, visit, [...keys, key]) : entry];
            }),
        );
    return value;
}

/**
 * Transform declared path leaves through the same native schemas used for runtime validation.
 * @param schema the field's authoritative validator.
 * @param value the already validated authored value.
 * @param visit the required native path calculation.
 * @param keys the field's location in its authored table.
 * @returns the value with only declared path leaves transformed.
 */
export function mapPolicyPaths(schema: z.ZodType, value: unknown, visit: PolicyPathCallback, keys: KeyPath): unknown {
    const role = schema.meta()?.pathRole;
    if (typeof value === 'string' && role !== undefined) return visit(value, keys, role);
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault)
        return mapPolicyPaths(z.instanceof(z.ZodType).parse(schema.unwrap()), value, visit, keys);
    if (schema instanceof z.ZodUnion) {
        const branch = schema.options.find((option) => z.safeParse(option, value).success);
        return mapPolicyPaths(z.instanceof(z.ZodType).parse(branch), value, visit, keys);
    }
    return tablePaths(schema, value, visit, keys);
}

/**
 * Join an authored selector to its owning scope while retaining a leading exclusion marker.
 * @param path the authored selector.
 * @param scope the repository-relative owning scope.
 * @returns the repository-relative selector.
 */
export function prefixScopePath(path: string, scope: string): string {
    if (scope === '' || path === '') return path;
    return path.startsWith('!') ? `!${scope}/${path.slice(1)}` : `${scope}/${path}`;
}

/**
 * Resolve a setting's declared path leaves against the scope that authors or defaults it.
 * @param key the compiler-owned setting key.
 * @param value the already validated authored value or selected default.
 * @param scope the owning scope path, empty for repository-root values.
 * @returns repository-relative path values without changing identities or native tool options.
 */
export function settingPaths(key: string, value: unknown, scope: string): unknown {
    if (scope === '' || value === undefined) return value;
    const schema = settingSchemas.get(key);
    return schema === undefined
        ? value
        : mapPolicyPaths(schema, value, (path) => prefixScopePath(path, scope), key.split('.'));
}

/**
 * Normalize authored scope paths with their native compiler-owned field schemas.
 * @param authored the validated scope whose raw source values remain separate.
 * @param path the owning repository-relative scope.
 * @returns validated scope tables with repository-relative path leaves.
 */
export function scopePolicyPaths(authored: RawScope, path: string): RawScope {
    const values = normalizeTables(authored);
    if (!isRecord(values)) throw new Error('The authored scope is not a table.');
    const keys = ['test_files', ...Object.keys(settingValueSchemas)].filter(
        (key) => !key.startsWith('architecture.roles'),
    );
    for (const key of keys) {
        const parts = key.split('.');
        const value = valueAt(authored, parts);
        if (value === undefined) continue;
        const holder = createTable(values, parts.slice(0, -1));
        const name = parts.at(-1);
        if (holder === undefined || name === undefined)
            throw new Error(`The declared setting ${key} is not a table field.`);
        holder[name] = settingPaths(key, value, path);
    }
    return scopeSchema.parse(values);
}

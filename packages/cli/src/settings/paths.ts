import { z } from 'zod';
import { isTable } from '#cli/system/tables.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { PathVisitor } from '#cli/types/settings/inheritance.ts';
import { findSettingSchema } from '#cli/schemas/settings/gspot-toml.ts';

function mapNestedPaths(schema: z.ZodType, value: unknown, visit: PathVisitor, keys: KeyPath): unknown {
    if (schema instanceof z.ZodUnion) {
        const branch = schema.options.find((option) => z.safeParse(option, value).success) as z.ZodType;
        return mapSettingPaths(branch, value, visit, keys);
    }
    if (schema instanceof z.ZodArray && Array.isArray(value))
        return value.map((entry: unknown, index) =>
            mapSettingPaths(schema.element as z.ZodType, entry, visit, [...keys, index]),
        );
    if (!isTable(value)) return value;
    if (schema instanceof z.ZodRecord) {
        const role = (schema.keyType as z.ZodType).meta()?.path_role;
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [
                role === undefined ? key : visit(key, [...keys, key], role),
                mapSettingPaths(schema.valueType as z.ZodType, entry, visit, [...keys, key]),
            ]),
        );
    }
    if (schema instanceof z.ZodObject)
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => {
                const field = schema.shape[key] as z.ZodType | undefined;
                return [key, field === undefined ? entry : mapSettingPaths(field, entry, visit, [...keys, key])];
            }),
        );
    return value;
}

/**
 * Change the declared path leaves with the schemas that validation uses.
 *
 * @param schema the validator of the field.
 * @param value the validated written setting.
 * @param visit changes one path.
 * @param keys where the field sits in its table.
 * @returns the setting with only its declared path leaves changed.
 */
export function mapSettingPaths(schema: z.ZodType, value: unknown, visit: PathVisitor, keys: KeyPath): unknown {
    const role = schema.meta()?.path_role;
    if (typeof value === 'string' && role !== undefined) return visit(value, keys, role);
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault || schema instanceof z.ZodPrefault)
        return mapSettingPaths(schema.unwrap() as z.ZodType, value, visit, keys);
    return mapNestedPaths(schema, value, visit, keys);
}

/**
 * Join a shipped default selector to its scope, and keep a leading exclusion mark.
 *
 * @param path the shipped default selector.
 * @param scope the repository-relative folder that owns the default.
 * @returns the repository-relative selector.
 */
export function joinScopeSelector(path: string, scope: string): string {
    if (scope === '' || path === '') return path;
    return path.startsWith('!') ? `!${scope}/${path.slice(1)}` : `${scope}/${path}`;
}

/**
 * Resolve the path leaves of a shipped default against its project scope.
 *
 * @param key the dotted setting name.
 * @param value the validated default.
 * @param scope the owning folder, empty for repository-root values.
 * @returns repository-relative path values without changing identities or tool options.
 */
export function joinDefaultPaths(key: string, value: unknown, scope: string): unknown {
    if (scope === '' || value === undefined) return value;
    const schema = findSettingSchema(key);
    return schema === undefined
        ? value
        : mapSettingPaths(schema, value, (path) => joinScopeSelector(path, scope), key.split('.'));
}

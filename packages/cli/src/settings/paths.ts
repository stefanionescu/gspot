import { z } from 'zod';
import { isRecord } from '#cli/system/values.ts';
import type { PathVisitor } from '#cli/types/settings/values.ts';
import { settingSchema } from '#cli/settings/schema/gspot-toml.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';

function tablePaths(schema: z.ZodType, value: unknown, visit: PathVisitor, keys: KeyPath): unknown {
    if (schema instanceof z.ZodUnion) {
        const branch = schema.options.find((option) => z.safeParse(option, value).success) as z.ZodType;
        return mapSettingPaths(branch, value, visit, keys);
    }
    if (schema instanceof z.ZodArray && Array.isArray(value))
        return value.map((entry: unknown, index) =>
            mapSettingPaths(schema.element as z.ZodType, entry, visit, [...keys, index]),
        );
    if (!isRecord(value)) return value;
    if (schema instanceof z.ZodRecord) {
        const role = (schema.keyType as z.ZodType).meta()?.pathRole;
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
 * Transform declared path leaves through the same schemas used for runtime validation.
 * @param schema the field's authoritative validator.
 * @param value the already validated written value.
 * @param visit the required path calculation.
 * @param keys the field's location in its written table.
 * @returns the value with only declared path leaves transformed.
 */
export function mapSettingPaths(schema: z.ZodType, value: unknown, visit: PathVisitor, keys: KeyPath): unknown {
    const role = schema.meta()?.pathRole;
    if (typeof value === 'string' && role !== undefined) return visit(value, keys, role);
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault || schema instanceof z.ZodPrefault)
        return mapSettingPaths(schema.unwrap() as z.ZodType, value, visit, keys);
    return tablePaths(schema, value, visit, keys);
}

/**
 * Join a shipped default selector to its owning scope while retaining a leading exclusion marker.
 * @param path the shipped default selector.
 * @param scope the repository-relative owning scope.
 * @returns the repository-relative selector.
 */
export function prefixScopePath(path: string, scope: string): string {
    if (scope === '' || path === '') return path;
    return path.startsWith('!') ? `!${scope}/${path.slice(1)}` : `${scope}/${path}`;
}

/**
 * Resolve a shipped setting default's path leaves against its project scope.
 * @param key the dotted setting key.
 * @param value the already validated selected default.
 * @param scope the owning scope path, empty for repository-root values.
 * @returns repository-relative path values without changing identities or tool options.
 */
export function settingPaths(key: string, value: unknown, scope: string): unknown {
    if (scope === '' || value === undefined) return value;
    const schema = settingSchema(key);
    return schema === undefined
        ? value
        : mapSettingPaths(schema, value, (path) => prefixScopePath(path, scope), key.split('.'));
}

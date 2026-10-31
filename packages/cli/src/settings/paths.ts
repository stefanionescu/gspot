import { z } from 'zod';
import { isTable } from '#cli/system/tables.ts';
import { GspotError } from '#cli/system/errors.ts';
import { buildArgumentPath } from '#cli/repository/scopes.ts';
import { findSettingSchema } from '#cli/settings/schema/lookup.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { PathVisitor } from '#cli/types/settings/inheritance.ts';

function mapNestedPaths(schema: z.ZodType, value: unknown, visit: PathVisitor, keys: KeyPath): unknown {
    if (schema instanceof z.ZodUnion) {
        const branch = schema.options.find((option) => z.safeParse(option, value).success) as z.ZodType;
        return mapSettingPaths(branch, value, visit, keys);
    }
    if (schema instanceof z.ZodArray && Array.isArray(value))
        return value.map((element: unknown, index) =>
            mapSettingPaths(schema.element as z.ZodType, element, visit, [...keys, index]),
        );
    if (!isTable(value)) return value;
    if (schema instanceof z.ZodRecord) {
        const role = (schema.keyType as z.ZodType).meta()?.path_role;
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [
                role === undefined ? key : visit(key, [...keys, key], role),
                mapSettingPaths(schema.valueType as z.ZodType, child, visit, [...keys, key]),
            ]),
        );
    }
    if (schema instanceof z.ZodObject)
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => {
                const field = schema.shape[key] as z.ZodType | undefined;
                return [key, field === undefined ? child : mapSettingPaths(field, child, visit, [...keys, key])];
            }),
        );
    return value;
}

/**
Change the declared path leaves with the schemas that validation uses.

@param schema the validator of the field.
@param value the validated written setting.
@param visit changes one path.
@param keys where the field sits in its table.
@returns the setting with only its declared path leaves changed.
*/
export function mapSettingPaths(schema: z.ZodType, value: unknown, visit: PathVisitor, keys: KeyPath): unknown {
    if (schema instanceof z.ZodPipe) return mapSettingPaths(schema.in as z.ZodType, value, visit, keys);
    const role = schema.meta()?.path_role;
    if (typeof value === 'string' && role !== undefined) return visit(value, keys, role);
    return schema instanceof z.ZodOptional || schema instanceof z.ZodDefault || schema instanceof z.ZodPrefault
        ? mapSettingPaths(schema.unwrap() as z.ZodType, value, visit, keys)
        : mapNestedPaths(schema, value, visit, keys);
}

/**
Join a shipped default selector to its scope, and keep a leading exclusion mark.

@param path the shipped default selector.
@param scopePath the repository-relative folder that owns the default.
@returns the repository-relative selector.
*/
export function joinScopeSelector(path: string, scopePath: string): string {
    if (scopePath === '' || path === '') return path;
    return path.startsWith('!') ? `!${scopePath}/${path.slice(1)}` : `${scopePath}/${path}`;
}

/**
Resolve the path leaves of a shipped default against its project scope.

@param key the dotted setting name.
@param value the validated default.
@param scopePath the owning folder, empty for repository-root values.
@returns repository-relative path values without changing identities or tool options.
*/
export function joinDefaultPaths(key: string, value: unknown, scopePath: string): unknown {
    if (scopePath === '' || value === undefined) return value;
    const schema = findSettingSchema(key);
    return schema === undefined
        ? value
        : mapSettingPaths(schema, value, (path) => joinScopeSelector(path, scopePath), key.split('.'));
}

/**
Resolve command selectors relative to the calling folder.

@param root the repository root.
@param cwd the command folder.
@param paths the selectors supplied with --paths.
@returns selectors rooted in the repository, preserving exclusions.
*/
export function buildArgumentPaths(root: string, cwd: string, paths: string[] | undefined): string[] | undefined {
    return paths?.map((path) => {
        const negative = path.startsWith('!');
        try {
            const selector = buildArgumentPath(root, cwd, negative ? path.slice(1) : path);
            return negative ? `!${selector}` : selector;
        } catch (error) {
            throw new GspotError('arguments', `--paths ${path} is outside this repository. Name a path inside it.`, {
                cause: error,
            });
        }
    });
}

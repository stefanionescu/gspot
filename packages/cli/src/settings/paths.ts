import { z } from 'zod';
import { join } from 'node:path';
import { statSync } from 'node:fs';
import { isTable } from '#cli/system/tables.ts';
import { escapeGlob } from '#cli/system/paths.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { findSettingSchema } from '#cli/settings/lookup.ts';
import { buildArgumentPath } from '#cli/repository/scopes.ts';
import type { PathVisitor, SettingLocation } from '#cli/types/settings.ts';
import { GLOB_BRACKETS, RECORD_PATHS_KEY, REASONED_VALUE_KEY } from '#cli/config/settings/validation.ts';

function escapeLiteralPath(root: string, path: string): string {
    const segments = path.split('/');
    for (let index = segments.length; index > 0; index -= 1) {
        const prefix = segments.slice(0, index).join('/');
        if (!GLOB_BRACKETS.test(prefix)) return path;
        if (statSync(join(root, prefix), { throwIfNoEntry: false }) !== undefined)
            return [escapeGlob(prefix), ...segments.slice(index)].join('/');
    }
    return path;
}

function mapNestedPaths(schema: z.ZodType, value: unknown, visit: PathVisitor, location: SettingLocation): unknown {
    const { keys, names } = location;
    if (schema instanceof z.ZodUnion) {
        const branch = schema.options.find((option) => z.safeParse(option, value).success) as z.ZodType;
        return mapSettingPaths(branch, value, visit, location);
    }
    if (schema instanceof z.ZodArray && Array.isArray(value))
        return value.map((element: unknown, index) =>
            mapSettingPaths(schema.element as z.ZodType, element, visit, { keys: [...keys, index], names }),
        );
    if (!isTable(value)) return value;
    if (schema instanceof z.ZodRecord) {
        const role = (schema.keyType as z.ZodType).meta()?.path_role;
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => {
                const next = { keys: [...keys, key], names: [...names, key] };
                return [
                    role === undefined ? key : visit(key, next, role),
                    mapSettingPaths(schema.valueType as z.ZodType, child, visit, next),
                ];
            }),
        );
    }
    if (schema instanceof z.ZodObject)
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => {
                const field = schema.shape[key] as z.ZodType | undefined;
                const isUnnamed = key === RECORD_PATHS_KEY || (key === REASONED_VALUE_KEY && isReasonedValue(value));
                const next = { keys: [...keys, key], names: isUnnamed ? names : [...names, key] };
                return [key, field === undefined ? child : mapSettingPaths(field, child, visit, next)];
            }),
        );
    return value;
}

/**
Change the declared path leaves with the schemas that validation uses.

@param schema the validator of the field.
@param value the validated written setting.
@param visit changes one path.
@param location where the field sits in its table, and the name of its setting or record.
*/
export function mapSettingPaths(
    schema: z.ZodType,
    value: unknown,
    visit: PathVisitor,
    location: SettingLocation,
): unknown {
    let input = schema;
    while (input instanceof z.ZodPipe) input = input.in as z.ZodType;
    const role = input.meta()?.path_role;
    if (typeof value === 'string' && role !== undefined) return visit(value, location, role);
    return input instanceof z.ZodOptional || input instanceof z.ZodDefault || input instanceof z.ZodPrefault
        ? mapSettingPaths(input.unwrap() as z.ZodType, value, visit, location)
        : mapNestedPaths(input, value, visit, location);
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
Resolve the path leaves of a setting value against the table that sets it.

@param key the dotted setting name.
@param value the validated value.
@param scopePath the owning folder, empty for repository-root values.
@param buildFolder the folder that holds built-output paths.
@returns repository-relative path values without changing identities or tool options.
*/
export function joinSettingPaths(key: string, value: unknown, scopePath: string, buildFolder = ''): unknown {
    const schema = findSettingSchema(key);
    return schema === undefined || value === undefined
        ? value
        : mapSettingPaths(
              schema,
              value,
              (path, _location, role) => joinScopeSelector(path, role === 'build' ? buildFolder : scopePath),
              { keys: key.split('.'), names: key.split('.') },
          );
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
        const isNegative = path.startsWith('!');
        try {
            const selector = escapeLiteralPath(root, buildArgumentPath(root, cwd, isNegative ? path.slice(1) : path));
            return isNegative ? `!${selector}` : selector;
        } catch (error) {
            throw new GspotError('arguments', `--paths ${path} is outside this repository. Name a path inside it.`, {
                cause: error,
            });
        }
    });
}

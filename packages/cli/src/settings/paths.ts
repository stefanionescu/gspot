import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import { z } from 'zod';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GLOB_BRACKETS, REASONED_VALUE_KEY, RECORD_PATHS_KEY } from '#cli/config/settings/validation.ts';
import { GLOB_EXCLUDE } from '#cli/config/system.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { findSettingSchema, isReasonedValue } from '#cli/settings/lookup.ts';
import { buildArgumentPath, convertToPosixPath, stripTrailingSlashes } from '#cli/system/paths.ts';
import { escapeGlob } from '#cli/system/patterns.ts';
import { isTable } from '#cli/system/tables.ts';
import type { PathVisitor, SettingLocation } from '#cli/types/settings.ts';

function escapeLiteralPath(root: string, path: string): string {
    const segments = path.split('/');
    for (let index = segments.length; index > 0; index -= 1) {
        const prefix = segments.slice(0, index).join('/');
        if (!GLOB_BRACKETS.test(prefix)) return path;
        if (existsSync(join(root, prefix))) return [escapeGlob(prefix), ...segments.slice(index)].join('/');
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

export function joinScopeSelector(path: string, scopePath: string): string {
    if (scopePath === '' || path === '') return path;
    return path.startsWith(GLOB_EXCLUDE) ? `${GLOB_EXCLUDE}${scopePath}/${path.slice(1)}` : `${scopePath}/${path}`;
}

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

export function buildArgumentPaths(root: string, cwd: string, paths: string[] | undefined): string[] | undefined {
    return paths?.map((path) => {
        const isNegative = path.startsWith(GLOB_EXCLUDE);
        const selector = escapeLiteralPath(
            root,
            buildArgumentPath(root, cwd, isNegative ? path.slice(1) : path, '--paths'),
        );
        return isNegative ? `${GLOB_EXCLUDE}${selector}` : selector;
    });
}

export function formatArgumentSelector(root: string, cwd: string, selector: string): string {
    const isNegative = selector.startsWith(GLOB_EXCLUDE);
    const absolute = join(root, isNegative ? selector.slice(1) : selector);
    const path = convertToPosixPath(relative(cwd, absolute)) || '.';
    return isNegative ? `${GLOB_EXCLUDE}${path}` : path;
}

export function isRuleFileExcluded(path: string, excluded: string): boolean {
    return isInScope(`${GSPOT_PATHS.rules}/${path}`, stripTrailingSlashes(excluded));
}

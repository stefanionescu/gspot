import { z } from 'zod';

import { PATH_ROLES } from '#cli/config/manifests.ts';
import { CATEGORY_PARENTS } from '#cli/config/settings/validation.ts';
import { configurationTableSchemas } from '#cli/schemas/settings/configurations.ts';
import { formatSchema } from '#cli/schemas/settings/fields.ts';
import { commandCheckSchema, ignoreSchema, scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import { importRulesSchema, namingSchema } from '#cli/schemas/settings/tables.ts';
import { toolsSchema } from '#cli/schemas/settings/tools.ts';
import type { Setting } from '#cli/types/manifests.ts';
import type { KeyPath } from '#cli/types/parsers.ts';

const NAMING_KEY_LENGTH = 4;

export const RECORD_FIELDS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
    Object.entries({
        scope: scopeSchema.pick({
            path: true,
            configurations: true,
            removed_configurations: true,
            test_files: true,
        }).shape,
        command_check: commandCheckSchema.shape,
        ignore: ignoreSchema.shape,
        import_rule: importRulesSchema.unwrap().element.shape,
        'format.override': formatSchema.shape.override.unwrap().element.shape,
        'naming.exception': namingSchema.shape.exception.unwrap().element.shape,
        'coverage.swift_target': configurationTableSchemas.coverage.unwrap().shape.swift_target.unwrap().element.shape,
        'licenses.allowed_package': configurationTableSchemas.licenses.unwrap().shape.allowed_package.unwrap().element
            .shape,
        'tools.eslint.override': toolsSchema.shape.eslint.unwrap().shape.override.unwrap().element.shape,
        'json.schemas': configurationTableSchemas.json.unwrap().shape.schemas.unwrap().element.shape,
    }).map(([name, fields]) => [name, Object.keys(fields)]),
);

function getSettingValueType(schema: z.ZodType, isPath: boolean): Setting['type'] {
    if (schema instanceof z.ZodArray) return 'list';
    if (schema instanceof z.ZodNumber) return 'number';
    if (schema instanceof z.ZodBoolean) return 'boolean';
    if (schema instanceof z.ZodObject || schema instanceof z.ZodRecord) return 'table';
    return isPath ? 'path' : 'string';
}

function unwrapSettingInput(schema: z.ZodType): z.ZodType {
    let inner = unwrapSettingSchema(schema);
    while (inner instanceof z.ZodPipe || inner instanceof z.ZodUnion) {
        let next = inner instanceof z.ZodUnion ? inner.options[0] : inner.out;
        if (inner instanceof z.ZodPipe && next instanceof z.ZodTransform) next = inner.in;
        inner = unwrapSettingSchema(next as z.ZodType);
    }
    return inner;
}

export function unwrapSettingSchema(schema: z.ZodType): z.ZodType {
    let inner = schema;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault || inner instanceof z.ZodPrefault)
        inner = inner.unwrap() as z.ZodType;
    return inner;
}

export function unwrapSchemaPipes(schema: z.ZodType): z.ZodType {
    let inner = unwrapSettingSchema(schema);
    while (inner instanceof z.ZodPipe) inner = unwrapSettingSchema(inner.in as z.ZodType);
    return inner;
}

export function findSchemaAt(segments: KeyPath, root: z.ZodType = settingsSchema): z.ZodType | undefined {
    let schema: z.ZodType | undefined = root;
    for (const segment of segments) schema = findChildSchema(schema, segment);
    return schema;
}

export function findSettingSchema(key: string, root?: z.ZodType): z.ZodType | undefined {
    return findSchemaAt(key.split('.'), root);
}

export function findNamingParent(key: string): string | undefined {
    if (!key.startsWith('naming.') || findSettingSchema(key) !== undefined) return undefined;
    const [table = '', language = '', category = '', field = ''] = key.split('.', NAMING_KEY_LENGTH);
    const parent = CATEGORY_PARENTS[category];
    return parent === undefined ? `${table}.${language}.cases` : `${table}.${language}.${parent}.${field}`;
}

export function findChildSchema(schema: z.ZodType | undefined, segment: KeyPath[number]): z.ZodType | undefined {
    const table = schema === undefined ? undefined : unwrapSchemaPipes(schema);
    if (table instanceof z.ZodUnion)
        return table.options
            .map((option) => findChildSchema(option as z.ZodType, segment))
            .find((child) => child !== undefined);
    if (table instanceof z.ZodRecord) return table.valueType as z.ZodType;
    if (typeof segment === 'number' && table instanceof z.ZodArray) return table.element as z.ZodType;
    return table instanceof z.ZodObject ? (table.shape[String(segment)] as z.ZodType | undefined) : undefined;
}

export function getSettingType(schema: z.ZodType): Pick<Setting, 'type' | 'path_role'> {
    const inner = unwrapSettingInput(schema);
    const metadata = schema.meta() ?? inner.meta();
    const elementRole = inner instanceof z.ZodArray ? (inner.element as z.ZodType).meta()?.['path_role'] : undefined;
    const role = metadata?.['path_role'] ?? elementRole;
    const pathRole = PATH_ROLES.find((allowed) => allowed === role);
    return {
        type: getSettingValueType(inner, pathRole !== undefined),
        ...(pathRole !== undefined && { path_role: pathRole }),
    };
}

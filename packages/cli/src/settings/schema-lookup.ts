import { z } from 'zod';
import { PATH_ROLES } from '#cli/config/settings/available.ts';
import { formatSchema } from '#cli/schemas/settings/fields.ts';
import { namingSchema } from '#cli/schemas/settings/naming.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { toolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import { importRulesSchema } from '#cli/schemas/settings/import-rules.ts';
import { configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { scopeSchema, ignoreSchema, settingsSchema, commandCheckSchema } from '#cli/schemas/settings/file.ts';

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
        'naming.override': namingSchema.shape.override.unwrap().element.shape,
        'coverage.swift_target': configurationTableSchemas.coverage.unwrap().shape.swift_target.unwrap().element.shape,
        'licenses.allowed_package': configurationTableSchemas.licenses.unwrap().shape.allowed_package.unwrap().element
            .shape,
        'site.size_limit': configurationTableSchemas.site.unwrap().shape.size_limit.unwrap().element.shape,
        'tools.eslint.override': toolsSchema.shape.eslint.unwrap().shape.override.unwrap().element.shape,
        'tools.v8r.schema': toolsSchema.shape.v8r.unwrap().shape.schema.unwrap().element.shape,
    }).map(([name, fields]) => [name, Object.keys(fields)]),
);

/**
Remove optional and default wrappers to inspect the shape of a setting.

@param schema the validator to inspect.
*/
export function unwrapSettingSchema(schema: z.ZodType): z.ZodType {
    let inner = schema;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault || inner instanceof z.ZodPrefault)
        inner = inner.unwrap() as z.ZodType;
    return inner;
}

/**
Locate one setting in the root, configuration, and tool schemas, or in another table such as a [[scope]] record.

@param key the dotted setting name.
@param root the table that holds the setting.
@returns undefined when the key names no setting.
*/
export function findSettingSchema(key: string, root: z.ZodType = settingsSchema): z.ZodType | undefined {
    let schema: z.ZodType | undefined = root;
    for (const segment of key.split('.')) schema = findChildSchema(schema, segment);
    return schema;
}

/**
Find a field or element schema within a settings schema.

@param schema the enclosing validator.
@param segment the field or array index.
@returns the child validator when present.
*/
export function findChildSchema(schema: z.ZodType | undefined, segment: KeyPath[number]): z.ZodType | undefined {
    let table = schema === undefined ? undefined : unwrapSettingSchema(schema);
    while (table instanceof z.ZodPipe) table = unwrapSettingSchema(table.in as z.ZodType);
    if (table instanceof z.ZodUnion)
        return table.options
            .map((option) => findChildSchema(option as z.ZodType, segment))
            .find((child) => child !== undefined);
    if (table instanceof z.ZodRecord) return table.valueType as z.ZodType;
    if (typeof segment === 'number' && table instanceof z.ZodArray) return table.element as z.ZodType;
    return table instanceof z.ZodObject ? (table.shape[String(segment)] as z.ZodType | undefined) : undefined;
}

/**
Describe the input type and path role of a setting without converting its schema.

@param schema the setting validator.
@returns its public value type and optional path role.
*/
export function getSettingType(schema: z.ZodType): Pick<Setting, 'type' | 'path_role'> {
    const inner = settingInputSchema(schema);
    const metadata = schema.meta() ?? inner.meta();
    const elementRole = inner instanceof z.ZodArray ? (inner.element as z.ZodType).meta()?.['path_role'] : undefined;
    const role = metadata?.['path_role'] ?? elementRole;
    const pathRole = PATH_ROLES.find((allowed) => allowed === role);
    return {
        type: settingValueType(inner, pathRole !== undefined),
        ...(pathRole === undefined ? {} : { path_role: pathRole }),
    };
}

function settingValueType(schema: z.ZodType, path: boolean): Setting['type'] {
    if (schema instanceof z.ZodArray) return 'list';
    if (schema instanceof z.ZodNumber) return 'number';
    if (schema instanceof z.ZodBoolean) return 'boolean';
    if (schema instanceof z.ZodObject || schema instanceof z.ZodRecord) return 'table';
    return path ? 'path' : 'string';
}

function settingInputSchema(schema: z.ZodType): z.ZodType {
    let inner = unwrapSettingSchema(schema);
    while (inner instanceof z.ZodPipe || inner instanceof z.ZodUnion)
        inner = unwrapSettingSchema(
            inner instanceof z.ZodPipe ? (inner.out as z.ZodType) : (inner.options[0] as z.ZodType),
        );
    return inner;
}

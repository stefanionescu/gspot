import { z } from 'zod';
import { formatSchema } from '#cli/schemas/settings/fields.ts';
import { namingSchema } from '#cli/schemas/settings/naming.ts';
import { toolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import { importRulesSchema } from '#cli/schemas/settings/import-rules.ts';
import { tableSettingSchemas, configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { scopeSchema, ignoreSchema, commandCheckSchema, rootSettingSchemas } from '#cli/schemas/settings/file.ts';

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

const schemas = new Map<string, z.ZodType>(Object.entries({ ...rootSettingSchemas, ...tableSettingSchemas }));
const toolSchemas = new Map<string, z.ZodType>(Object.entries(toolsSchema.shape));
const configurationSchemas = new Map<string, z.ZodType>(Object.entries(configurationTableSchemas));

/**
Remove optional and default wrappers to inspect the shape of a setting.

@param schema the validator to inspect.
@returns the inner validator.
*/
export function unwrapSettingSchema(schema: z.ZodType): z.ZodType {
    let inner = schema;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault || inner instanceof z.ZodPrefault)
        inner = inner.unwrap() as z.ZodType;
    return inner;
}

/**
Locate one setting in the root, configuration, and tool schemas.

@param key the dotted setting name.
@returns its schema, or undefined when the key names no setting.
*/
export function findSettingSchema(key: string): z.ZodType | undefined {
    const direct = schemas.get(key);
    if (direct !== undefined) return direct;
    const segments = key.split('.');
    const table = segments.shift();
    let schema: z.ZodType | undefined;
    if (table === 'tools') {
        const tool = segments.shift();
        schema = toolSchemas.get(tool ?? '');
    } else schema = configurationSchemas.get(table ?? '');
    for (const segment of segments) {
        if (schema !== undefined) schema = unwrapSettingSchema(schema);
        if (!(schema instanceof z.ZodObject)) return undefined;
        schema = schema.shape[segment] as z.ZodType | undefined;
    }
    return schema;
}

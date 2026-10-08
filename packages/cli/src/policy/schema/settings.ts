import { z } from 'zod';
import { relativePath } from '#cli/policy/schema/fields.ts';
import { FULL_PERCENTAGE } from '#cli/config/platform/runtime.ts';
import type { CompiledSetting } from '#cli/types/policy/setting-values.ts';
import { settingItemsSchema, type settingPrimitiveSchema } from '#cli/parsers/schema/settings.ts';
import type { SettingField, SettingFields, SettingValueDeclaration } from '#cli/types/parsers/settings.ts';

function compileSettingFields(fields: SettingFields): CompiledSetting {
    const compiled = Object.entries(fields).map(([name, definition]) => {
        const field = typeof definition === 'string' ? { type: definition } : definition;
        const value = compileSettingField(field);
        return [name, value] as const;
    });
    const expressions = compiled.map(([name, value]) => `${JSON.stringify(name)}:${value.expression}`);
    return {
        schema: z.strictObject(Object.fromEntries(compiled.map(([name, value]) => [name, value.schema]))),
        expression: `z.strictObject({${expressions.join(',')}})`,
    };
}

function compileSettingField(field: SettingField): CompiledSetting {
    let value: CompiledSetting;
    switch (field.type) {
        case 'list': {
            const item =
                typeof field.items === 'string'
                    ? compileSettingField({ type: field.items })
                    : compileSettingFields(field.items);
            value = { schema: z.array(item.schema), expression: `z.array(${item.expression})` };
            break;
        }
        case 'table': {
            value = compileSettingFields(field.fields);
            break;
        }
        default: {
            value = compileSettingPrimitive(field.type, field.validation);
        }
    }
    return field.optional === true
        ? { schema: value.schema.optional(), expression: `${value.expression}.optional()` }
        : value;
}

function compileSettingPrimitive(
    type: z.infer<typeof settingPrimitiveSchema>,
    validation: SettingValueDeclaration['validation'] = {},
): CompiledSetting {
    const diagnostic = validation.message;
    if (validation.enum !== undefined) {
        const { enum: choices, ...constraints } = validation;
        const base = compileSettingPrimitive(type, constraints);
        return {
            schema: base.schema.and(z.literal(choices, { error: diagnostic })),
            expression: `${base.expression}.and(z.literal(${JSON.stringify(choices)},${JSON.stringify({ error: diagnostic })}))`,
        };
    }
    switch (type) {
        case 'number': {
            return compileNumberSetting(validation);
        }
        case 'string': {
            if (validation.pattern === undefined) return { schema: z.string(), expression: 'z.string()' };
            const pattern = new RegExp(validation.pattern, 'u');
            return {
                schema: z.string().regex(pattern, diagnostic),
                expression: `z.string().regex(${String(pattern)},${JSON.stringify(diagnostic)})`,
            };
        }
        case 'path': {
            return { schema: relativePath, expression: 'relativePath' };
        }
        case 'boolean': {
            return { schema: z.boolean(), expression: 'z.boolean()' };
        }
    }
}

function compileNumberSetting(validation: SettingValueDeclaration['validation']): CompiledSetting<z.ZodNumber> {
    let schema = z.number();
    let expression = 'z.number()';
    const diagnostic = JSON.stringify(validation.message);
    if (validation.integer === true) {
        schema = schema.int(validation.message);
        expression += `.int(${diagnostic})`;
    }
    if (validation.minimum !== undefined) {
        schema = schema.min(validation.minimum, validation.message);
        expression += `.min(${String(validation.minimum)},${diagnostic})`;
    }
    if (validation.maximum !== undefined) {
        schema = schema.max(validation.maximum, validation.message);
        const maximum = validation.maximum === FULL_PERCENTAGE ? 'FULL_PERCENTAGE' : String(validation.maximum);
        expression += `.max(${maximum},${diagnostic})`;
    }
    return { schema, expression };
}

/**
 * Compile runtime validation and literal schema code from the same declaration.
 * @param declaration the setting's type and validated constraints
 * @returns the validator and its compiler expression
 */
export function compileSettingValue(declaration: SettingValueDeclaration): CompiledSetting {
    switch (declaration.type) {
        case 'path': {
            return declaration.default === '' || declaration.default_all === ''
                ? {
                      schema: z.union([z.literal(''), relativePath]),
                      expression: "z.union([z.literal(''),relativePath])",
                  }
                : { schema: relativePath, expression: 'relativePath' };
        }
        case 'list': {
            return compileSettingField({ type: 'list', items: settingItemsSchema.parse(declaration.items) });
        }
        case 'table': {
            return { schema: z.record(z.string(), z.unknown()), expression: 'z.record(z.string(),z.unknown())' };
        }
        default: {
            return compileSettingPrimitive(declaration.type, declaration.validation);
        }
    }
}

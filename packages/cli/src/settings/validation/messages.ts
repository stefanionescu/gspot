import { z } from 'zod';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import type { SettingsError } from '#cli/types/settings/file.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { TomlSyntax } from '#cli/types/parsers/formats/toml.ts';
import { unwrapSettingSchema } from '#cli/schemas/settings/fields.ts';

function formatValueAdvice(
    schema: z.ZodType | undefined,
    setting: Pick<Setting, 'type' | 'description'>,
    error: z.ZodError,
): string {
    const issue = error.issues.find((issue) => issue.code === 'invalid_value');
    if (issue !== undefined) return issue.values.map(String).join(' or ');
    let inner = schema === undefined ? undefined : unwrapSettingSchema(schema);
    if (inner instanceof z.ZodUnion) inner = inner.options[0] as z.ZodType;
    if (inner instanceof z.ZodNumber) return `a whole number of ${String(inner.minValue ?? 0)} or more`;
    const description = setting.description.replace(/\.$/u, '');
    return `a valid ${setting.type} value${description === '' ? '' : ': ' + description}`;
}

/**
Describe an invalid setting value for a command or a saved settings file.

@param value the value as shown to the reader.
@param setting the key, type, and description.
@param validation the schema and its failed validation.
@param validation.schema the setting validator.
@param validation.error the failed validation.
@returns the shared value error sentence.
*/
export function formatSettingValueError(
    value: string,
    setting: Pick<Setting, 'name' | 'type' | 'description'>,
    validation: { schema: z.ZodType | undefined; error: z.ZodError },
): string {
    const { schema, error } = validation;
    const advice = formatValueAdvice(schema, setting, error);
    const refinement = error.issues.find((issue) => issue.code === 'custom' || issue.code === 'invalid_format');
    const guidance =
        refinement === undefined || refinement.message.startsWith('Invalid ') ? `Use ${advice}.` : refinement.message;
    return `The value ${value} is not valid for ${setting.name}. ${guidance}`;
}

function getValueType(schema: z.ZodType | undefined): Setting['type'] {
    if (schema instanceof z.ZodArray) return 'list';
    if (schema instanceof z.ZodNumber) return 'number';
    if (schema instanceof z.ZodBoolean) return 'boolean';
    return schema instanceof z.ZodObject || schema instanceof z.ZodRecord ? 'table' : 'string';
}

function describeValueSchema(schema: z.ZodType | undefined): Pick<Setting, 'type' | 'description'> {
    let inner = schema === undefined ? undefined : unwrapSettingSchema(schema);
    if (inner instanceof z.ZodUnion) inner = inner.options[0] as z.ZodType;
    return { type: getValueType(inner), description: schema?.description ?? inner?.description ?? '' };
}

function displayValue(value: unknown): string {
    if (typeof value === 'string') return value;
    return value === undefined ? 'undefined' : JSON.stringify(value);
}

/**
Format a file value with the same sentence used by set, retaining custom validation guidance.

@param schema the validator of the failing field.
@param issue the failed validation.
@param value the value written in the file.
@returns a value error or the field's own validation sentence.
*/
export function formatFileValueError(schema: z.ZodType | undefined, issue: z.core.$ZodIssue, value: unknown): string {
    const validation = schema?.safeParse(value);
    if (validation === undefined || validation.success || issue.message.startsWith('needs ')) return issue.message;
    const setting = { name: issue.path.map(String).join('.'), ...describeValueSchema(schema) };
    return formatSettingValueError(displayValue(value), setting, {
        schema,
        error: validation.error,
    });
}

/**
Locate a settings error at its written key, array item, or nearest enclosing table.

@param error the key and its validation sentence.
@param syntax the source keys and their positions.
@returns the file, source line, key, and sentence.
*/
export function formatSettingsError(error: SettingsError, syntax: TomlSyntax): string {
    const source = syntax.pathNodes
        .filter((node) => node.path.every((key, index) => key === error.path[index]))
        .toSorted((left, right) => right.path.length - left.path.length)[0];
    const line = source?.node.loc.start.line ?? 1;
    return `${SETTINGS_FILE}:${String(line)}: ${error.path.map(String).join('.')}: ${error.message}`;
}

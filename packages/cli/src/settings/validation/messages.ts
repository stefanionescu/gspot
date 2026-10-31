import { z } from 'zod';
import { TRAILING_PERIOD } from '#cli/config/text.ts';
import type { TomlSyntax } from '#cli/types/parsers/formats.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { SettingsError } from '#cli/types/settings/settings.ts';
import { getSettingType, unwrapSettingSchema } from '#cli/settings/schema/lookup.ts';

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
    if (inner instanceof z.ZodBoolean) return 'true or false';
    const description = setting.description.replace(TRAILING_PERIOD, '');
    return `a valid ${setting.type} value${description === '' ? '' : ': ' + description}`;
}

/**
Describe an invalid setting value for a command or a saved settings file.

@param value the value as shown to the reader.
@param setting the key, type, and description.
@param validation the schema and its failed validation.
@param validation.schema the setting validator.
@param validation.error the failed validation.
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

/**
Format a file value with the same sentence used by set, retaining custom validation guidance.

@param schema the validator of the failing field.
@param issue the failed validation.
@param value the value written in the file.
@returns a value error or the field's own validation sentence.
*/
export function formatFileValueError(schema: z.ZodType | undefined, issue: z.core.$ZodIssue, value: unknown): string {
    if (schema === undefined || issue.message.startsWith('needs ')) return issue.message;
    const validation = schema.safeParse(value);
    if (validation.success) return issue.message;
    let inner = unwrapSettingSchema(schema);
    if (inner instanceof z.ZodUnion) inner = inner.options[0] as z.ZodType;
    const setting = {
        name: issue.path.map(String).join('.'),
        type: getSettingType(schema).type,
        description: schema.description ?? inner.description ?? '',
    };
    return formatSettingValueError(value === undefined ? 'undefined' : JSON.stringify(value), setting, {
        schema,
        error: validation.error,
    });
}

/**
Locate a settings error at its written key, array item, or nearest enclosing table.

@param error the key and its validation sentence.
@param syntax the source keys and their positions.
@param file the path that the message starts with.
*/
export function formatSettingsError(error: SettingsError, syntax: TomlSyntax, file: string): string {
    const source = syntax.pathNodes
        .filter((node) => node.path.every((key, index) => key === error.path[index]))
        .toSorted((left, right) => right.path.length - left.path.length)[0];
    const line = source?.node.loc.start.line ?? 1;
    return `${file}:${String(line)}: ${error.path.map(String).join('.')}: ${error.message}`;
}

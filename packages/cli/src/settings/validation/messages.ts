import { z } from 'zod';

import { SETTINGS_PAGE_SENTENCE, TRAILING_PERIOD } from '#cli/config/settings/validation.ts';
import { getSettingType, unwrapSettingInput } from '#cli/settings/lookup.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { Setting } from '#cli/types/manifests.ts';
import type { TomlSyntax } from '#cli/types/parsers.ts';
import type { SettingsError } from '#cli/types/settings.ts';

function formatValueAdvice(
    schema: z.ZodType | undefined,
    setting: Pick<Setting, 'type' | 'description'>,
    error: z.ZodError,
): string {
    const issue = error.issues.find((issue) => issue.code === 'invalid_value');
    if (issue !== undefined) return formatNameList(issue.values.map(String), 'disjunction');
    const inner = schema === undefined ? undefined : unwrapSettingInput(schema);
    if (inner instanceof z.ZodNumber) return `a whole number of ${String(inner.minValue ?? 0)} or more`;
    if (inner instanceof z.ZodBoolean) return 'true or false';
    const description = setting.description.replace(TRAILING_PERIOD, '');
    return `a valid ${setting.type} value${description === '' ? '' : ': ' + description}`;
}

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

export function formatFileValueError(schema: z.ZodType | undefined, issue: z.core.$ZodIssue, value: unknown): string {
    if (schema === undefined || issue.message.startsWith('needs ')) return issue.message;
    const validation = schema.safeParse(value);
    if (validation.success) return issue.message;
    const inner = unwrapSettingInput(schema);
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
Format each error with the line of the key it names. An error that names a table with no header of its own, such as
the path of a record list, takes the first line inside that table.
*/
export function formatSettingsErrors(errors: readonly SettingsError[], syntax: TomlSyntax, file: string): string {
    const lines = errors.map((error) => {
        const source = syntax.pathNodes
            .filter((node) => node.path.every((key, index) => key === error.path[index]))
            .toSorted((left, right) => right.path.length - left.path.length)[0];
        const [inside] = syntax.pathNodes
            .filter((node) => error.path.every((key, index) => key === node.path[index]))
            .map(({ node }) => node.loc.start.line)
            .toSorted((left, right) => left - right);
        const line = source?.node.loc.start.line ?? inside ?? 1;
        return `${file}:${String(line)}: ${error.path.map(String).join('.')}: ${error.message}`;
    });
    return [...lines, SETTINGS_PAGE_SENTENCE].join('\n');
}

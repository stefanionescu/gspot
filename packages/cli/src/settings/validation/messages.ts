import { z } from 'zod';
import { findValueAt } from '#cli/system/tables.ts';
import { formatNameList } from '#cli/system/text/messages.ts';
import type { KeyPath, TomlSyntax } from '#cli/types/parsers.ts';
import { TRAILING_PERIOD } from '#cli/config/settings/validation.ts';
import type { Setting, SettingsError } from '#cli/types/settings.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { RECORD_PATHS_MESSAGE, NO_CHECK_PATHS_MESSAGE, SETTINGS_PAGE_SENTENCE } from '#cli/config/settings/file.ts';

import {
    findSchemaAt,
    RECORD_FIELDS,
    getSettingType,
    unwrapSchemaPipes,
    unwrapSettingInput,
} from '#cli/settings/lookup.ts';

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
    const detail = description === '' ? '' : `: ${description}`;
    return `a valid ${setting.type} value${detail}`;
}

function formatEmptyIgnorePaths(issue: z.core.$ZodIssue, path: KeyPath, syntax: TomlSyntax): SettingsError | undefined {
    const [record, index, field] = path;
    if (record !== 'ignore' || field !== 'paths' || index === undefined || issue.code !== 'too_small') return undefined;
    const check = findValueAt(syntax.value, [record, index, 'check']);
    const message =
        typeof check === 'string'
            ? `paths = [] matches no path. Leave out paths to ignore ${check} everywhere, or list the paths.`
            : NO_CHECK_PATHS_MESSAGE;
    return { path, message };
}

function listSchemaKeys(segments: KeyPath): string[] {
    const schema = findSchemaAt(segments);
    const table = schema === undefined ? undefined : unwrapSchemaPipes(schema);
    const [record, , ...scopeFields] = segments;
    const fields = record === 'scope' ? scopeFields : segments;
    const prefix = fields.filter((segment) => typeof segment === 'string').join('.');
    return table instanceof z.ZodObject
        ? Object.keys(table.shape).map((key) => (prefix === '' ? key : `${prefix}.${key}`))
        : [];
}

function formatUnknownKey(segments: KeyPath, key: string): string {
    const [record, , ...scopeFields] = segments;
    const fields: Readonly<Record<string, readonly string[]>> = RECORD_FIELDS;
    const recordName = [...scopeFields, key].map(String).join('.');
    if (record === 'scope' && Object.hasOwn(fields, recordName))
        return `Write [[${recordName}]] at the root.${fields[recordName]?.includes('paths') === true ? RECORD_PATHS_MESSAGE : ''}`;
    const settingPath = record === 'scope' ? scopeFields : segments;
    const name = [...settingPath.filter((segment) => typeof segment === 'string'), key].join('.');
    const schemaKeys = listSchemaKeys(segments);
    return formatUnknownSetting(name, { available: schemaKeys, offered: new Set(schemaKeys) });
}

function formatFileValueError(schema: z.ZodType | undefined, issue: z.core.$ZodIssue, value: unknown): string {
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

export function formatSettingsIssue(issue: z.core.$ZodIssue, syntax: TomlSyntax): SettingsError[] {
    const branches = issue.code === 'invalid_union' ? issue.errors : [];
    const reasonedValueErrors = branches.find((errors) =>
        errors.some((child) => child.path[0] === 'value' || child.path[0] === 'reason'),
    );
    if (reasonedValueErrors !== undefined)
        return reasonedValueErrors.flatMap((child) =>
            formatSettingsIssue({ ...child, path: [...issue.path, ...child.path] }, syntax),
        );
    if (issue.code === 'invalid_key')
        return issue.issues.flatMap((child) =>
            formatSettingsIssue({ ...child, path: [...issue.path, ...child.path] }, syntax),
        );
    const segments = issue.path.filter((segment): segment is KeyPath[number] => typeof segment !== 'symbol');
    const emptyPaths = formatEmptyIgnorePaths(issue, segments, syntax);
    if (emptyPaths !== undefined) return [emptyPaths];
    if (issue.code === 'unrecognized_keys')
        return issue.keys.map((key) => ({ path: [...segments, key], message: formatUnknownKey(segments, key) }));
    const message = formatFileValueError(findSchemaAt(segments), issue, findValueAt(syntax.value, segments));
    return [{ path: segments, message }];
}

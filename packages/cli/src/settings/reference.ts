import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { compareText } from '#cli/system/text.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { SETTING_NAME_PLACEHOLDER } from '#cli/config/settings/schema.ts';
import { scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import { findSettingSchema, unwrapSettingSchema } from '#cli/settings/schema/lookup.ts';
import { buildAvailableSettings, SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import type { SettingVariant, SettingAccepted, SettingReference } from '#cli/types/reference.ts';

function inputSchema(schema: z.ZodType): z.ZodType {
    let inner = unwrapSettingSchema(schema);
    while (inner instanceof z.ZodPipe) inner = unwrapSettingSchema(inner.in as z.ZodType);
    return inner;
}

function acceptedAlternatives(schema: z.ZodUnion): SettingAccepted {
    const alternatives = schema.options.map((option) => acceptedValues(option as z.ZodType));
    const choicesOnly = alternatives.every((option) => option.choices.length > 0);
    return choicesOnly
        ? { types: [], choices: alternatives.flatMap((option) => option.choices), alternatives: [] }
        : { types: [], choices: [], alternatives };
}

function acceptedValues(schema: z.ZodType): SettingAccepted {
    const inner = inputSchema(schema);
    const description = schema.description;
    if (inner instanceof z.ZodLiteral)
        return { types: [], choices: [...inner.values].map((value) => ({ value, description })), alternatives: [] };
    if (inner instanceof z.ZodEnum)
        return {
            types: [],
            choices: Object.values(inner.enum).map((value) => ({ value, description: undefined })),
            alternatives: [],
        };
    if (inner instanceof z.ZodUnion) return acceptedAlternatives(inner);
    const type = inner instanceof z.ZodNumber && inner.format?.includes('int') === true ? 'integer' : inner.type;
    return { types: [type === 'record' ? 'object' : type], choices: [], alternatives: [] };
}

function childSchemas(schema: z.ZodType): Array<[string, z.ZodType]> {
    let inner = inputSchema(schema);
    if (inner instanceof z.ZodArray) inner = inputSchema(inner.element as z.ZodType);
    if (inner instanceof z.ZodObject) return Object.entries<z.ZodType>(inner.shape);
    if (inner instanceof z.ZodRecord && inputSchema(inner.valueType as z.ZodType) instanceof z.ZodObject)
        return [[SETTING_NAME_PLACEHOLDER, inner.valueType as z.ZodType]];
    return [];
}

function listSettingVariants(configurations: Configuration[]): SettingVariant[] {
    const variants: SettingVariant[] = [];
    const ownedSettings = [
        ...buildAvailableSettings([], 'basic')
            .settings.values()
            .map((setting) => ({ setting, owner: 'gspot' })),
        ...configurations.flatMap((configuration) =>
            (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []).map((setting) => ({
                setting,
                owner: configuration.name,
            })),
        ),
    ];
    for (const { setting, owner } of ownedSettings) {
        const variant = variants.find(
            (each) =>
                each.setting.name === setting.name &&
                isDeepStrictEqual(
                    [each.setting.default, each.setting.default_all],
                    [setting.default, setting.default_all],
                ),
        );
        if (variant === undefined) variants.push({ setting, owners: [owner] });
        else if (!variant.owners.includes(owner)) variant.owners.push(owner);
    }
    return variants.toSorted((left, right) => compareText(left.setting.name, right.setting.name));
}

function buildSettingNode(key: string, schema: z.ZodType, variants: SettingVariant[]): SettingReference {
    const inner = inputSchema(schema);
    const metadata = { ...inner.meta(), ...schema.meta() };
    const reasoned = metadata['reasoned'] === true;
    const children = reasoned
        ? []
        : childSchemas(schema).map(([name, child]) => buildSettingNode(`${key}.${name}`, child, variants));
    const scope = findSettingSchema(key, scopeSchema);
    const defaultValue = schema.safeParse(undefined);
    let kind: SettingReference['kind'] = inner instanceof z.ZodArray ? 'record' : 'table';
    if (children.length === 0) kind = 'value';
    return {
        key,
        name: key.slice(key.lastIndexOf('.') + 1),
        kind,
        required: !defaultValue.success,
        description: schema.description ?? inner.description,
        default: defaultValue.success ? defaultValue.data : undefined,
        reasoned,
        variantOf: typeof metadata['variantOf'] === 'string' ? metadata['variantOf'] : undefined,
        rootOnly: scope === undefined,
        scopeKeys: scope === undefined ? [] : childSchemas(scope).map(([name]) => name),
        accepted: acceptedValues(schema),
        variants: variants.filter(({ setting }) => setting.name === key),
        children,
    };
}

/**
Read the settings tree directly from the validators and their definitions, without inferring meaning from JSON Schema.

@param configurations the shipped configurations that supply settings and defaults.
*/
export function buildSettingsReference(configurations: Configuration[]): SettingReference[] {
    const variants = listSettingVariants(configurations);
    const fields = Object.entries(settingsSchema.shape);
    return fields.map(([key, schema]) => buildSettingNode(key, schema, variants));
}

import { isDeepStrictEqual } from 'node:util';

import { z } from 'zod';

import { DOCS_PATHS } from '#cli/config/manifests.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import {
    HIDDEN_FACT_KEYS,
    JSON_SCHEMA_DIALECT,
    SCHEMA_DESCRIPTION,
    SETTING_NAME_PLACEHOLDER,
} from '#cli/config/settings/file.ts';
import { listCheckIds } from '#cli/manifests/checks.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import { ROOT_SETTINGS, SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { extractKeyName, findSettingSchema, unwrapSchemaPipes } from '#cli/settings/lookup.ts';
import { compareText } from '#cli/system/text/order.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { AcceptedSettingValues, SettingReference, SettingVariant } from '#cli/types/settings.ts';

function buildAcceptedAlternatives(schema: z.ZodUnion): AcceptedSettingValues {
    const alternatives = schema.options.map((option) => buildAcceptedValues(option as z.ZodType));
    const isChoicesOnly = alternatives.every((option) => option.choices.length > 0);
    return isChoicesOnly
        ? { types: [], choices: alternatives.flatMap((option) => option.choices), alternatives: [] }
        : { types: [], choices: [], alternatives };
}

function buildAcceptedValues(schema: z.ZodType): AcceptedSettingValues {
    const inner = unwrapSchemaPipes(schema);
    const description = schema.description;
    if (inner instanceof z.ZodLiteral)
        return { types: [], choices: [...inner.values].map((value) => ({ value, description })), alternatives: [] };
    if (inner instanceof z.ZodEnum)
        return {
            types: [],
            choices: Object.values(inner.enum).map((value) => ({ value, description: undefined })),
            alternatives: [],
        };
    if (inner instanceof z.ZodUnion) return buildAcceptedAlternatives(inner);
    const type = inner instanceof z.ZodNumber && inner.format?.includes('int') === true ? 'integer' : inner.type;
    return { types: [type === 'record' ? 'object' : type], choices: [], alternatives: [] };
}

function childSchemas(schema: z.ZodType): Array<[string, z.ZodType]> {
    let inner = unwrapSchemaPipes(schema);
    if (inner instanceof z.ZodArray) inner = unwrapSchemaPipes(inner.element as z.ZodType);
    if (inner instanceof z.ZodObject) return Object.entries<z.ZodType>(inner.shape);
    return inner instanceof z.ZodRecord && unwrapSchemaPipes(inner.valueType as z.ZodType) instanceof z.ZodObject
        ? [[SETTING_NAME_PLACEHOLDER, inner.valueType as z.ZodType]]
        : [];
}

function listSettingVariants(configurations: Configuration[]): SettingVariant[] {
    const variants: SettingVariant[] = [];
    const ownedSettings = [
        ...ROOT_SETTINGS.map((setting) => ({ setting, owner: 'gspot' })),
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
    const inner = unwrapSchemaPipes(schema);
    const metadata = { ...inner.meta(), ...schema.meta() };
    const isReasoned = metadata.reasoned === true;
    const children = isReasoned
        ? []
        : childSchemas(schema).map(([name, child]) => buildSettingNode(`${key}.${name}`, child, variants));
    const scope = findSettingSchema(key, scopeSchema);
    const defaultValue = schema.safeParse(undefined);
    let kind: SettingReference['kind'] = inner instanceof z.ZodArray ? 'record' : 'table';
    if (children.length === 0) kind = 'value';
    return {
        key,
        name: extractKeyName(key),
        kind,
        required: !defaultValue.success,
        description: schema.description ?? inner.description,
        // A prefault value goes through the transforms, so the reference shows the value as gspot.toml writes it.
        default: schema instanceof z.ZodPrefault ? schema.def.defaultValue : defaultValue.data,
        reasoned: isReasoned,
        variantOf: metadata.variantOf,
        rootOnly: scope === undefined,
        scopeKeys: scope === undefined ? [] : childSchemas(scope).map(([name]) => name),
        accepted: buildAcceptedValues(schema),
        variants: variants.filter(({ setting }) => setting.name === key),
        children,
    };
}

/**
Copy the examples of a setting into its converted schema. A configuration name may only be a shipped name, and a check
ID gets the shipped IDs as examples, because a command check may add its own.
*/
function copySchemaExamples(zodSchema: z.core.$ZodType, jsonSchema: z.core.JSONSchema.BaseSchema): void {
    const definition = z.globalRegistry.get(zodSchema);
    if (definition?.['examples'] !== undefined) Object.assign(jsonSchema, { examples: definition['examples'] });
    if (definition?.value_names === 'configurations')
        jsonSchema.enum = readConfigurations().keys().toArray().toSorted(compareText);
    if (definition?.value_names === 'checks') jsonSchema.examples = listCheckIds([]);
}

function normalizeSchemaNode(zodSchema: z.core.$ZodType, jsonSchema: z.core.JSONSchema.BaseSchema): void {
    if (zodSchema instanceof z.ZodArray && jsonSchema.$ref !== undefined) jsonSchema.type = 'array';
    for (const key of HIDDEN_FACT_KEYS) Reflect.deleteProperty(jsonSchema, key);
    if (zodSchema instanceof z.ZodDefault && zodSchema.def.innerType instanceof z.ZodUnion) {
        delete jsonSchema.minimum;
        delete jsonSchema.maximum;
        jsonSchema.default = zodSchema.def.defaultValue;
    }
    copySchemaExamples(zodSchema, jsonSchema);
}

export function buildSettingsReference(configurations: Configuration[]): SettingReference[] {
    const variants = listSettingVariants(configurations);
    const fields = Object.entries(settingsSchema.shape);
    return fields.map(([key, schema]) => buildSettingNode(key, schema, variants));
}

export function buildJsonSchema(): z.core.JSONSchema.JSONSchema {
    const converted = z.toJSONSchema(settingsSchema, {
        io: 'input',
        reused: 'ref',
        override: ({ zodSchema, jsonSchema }) => {
            normalizeSchemaNode(zodSchema, jsonSchema);
        },
    });
    return {
        $schema: JSON_SCHEMA_DIALECT,
        $id: DOCS_PATHS.schema,
        title: SETTINGS_FILE,
        description: SCHEMA_DESCRIPTION,
        ...converted,
    };
}

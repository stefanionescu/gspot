import { z } from 'zod';
import { toolsSchema } from '#cli/policy/schema/tools.ts';
import { namingLists } from '#cli/parsers/schema/naming.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { TOOL_KEY_DEPTH } from '#cli/config/policy/settings.ts';
import { allowlistSchema } from '#cli/parsers/schema/licenses.ts';
import { compileSettingValue } from '#cli/policy/schema/settings.ts';
import { SETTING_DEFAULT_FIELDS } from '#cli/config/configurations.ts';
import type { CompiledSetting } from '#cli/types/policy/setting-values.ts';
import type { Manifest, SettingDeclaration } from '#cli/types/configurations.ts';
import { formatSchema, architectureRolesSchema, environmentReadersSchema } from '#cli/policy/schema/fields.ts';

import {
    POLICY_TABLE_NAMES,
    SETTING_VALUES_FILE,
    ACTIVE_SETTINGS_FILE,
    SETTING_SCHEMA_IMPORTS,
    SETTING_NAMESPACES_FILE,
    SETTING_NAMESPACE_IMPORTS,
} from '#cli/config/policy/setting-values.ts';

function unwrapSetting(value: CompiledSetting): CompiledSetting {
    let { schema, expression } = value;
    while (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
        schema = z.instanceof(z.ZodType).parse(schema.unwrap());
        expression += '.unwrap()';
    }
    return { schema, expression };
}

function childSetting(parent: CompiledSetting, keys: string[]): CompiledSetting | undefined {
    let value = parent;
    for (const key of keys) {
        const { schema, expression } = unwrapSetting(value);
        if (!(schema instanceof z.ZodObject) || !Object.hasOwn(schema.shape, key)) return undefined;
        value = {
            schema: z.instanceof(z.ZodType).parse(schema.shape[key]),
            expression: `${expression}.shape[${JSON.stringify(key)}]`,
        };
    }
    return unwrapSetting(value);
}

function nativeSetting(name: string): CompiledSetting | undefined {
    const [namespace, ...keys] = name.split('.');
    const owners = new Map<string, CompiledSetting>([
        ['tools', { schema: toolsSchema, expression: 'toolsSchema' }],
        ['licenses', { schema: allowlistSchema, expression: 'allowlistSchema' }],
        ['naming', { schema: namingLists, expression: 'namingLists' }],
        ['format', { schema: formatSchema, expression: 'formatSchema' }],
        [
            'secrets',
            {
                schema: z.strictObject({ reader_functions: environmentReadersSchema }),
                expression: 'z.strictObject({reader_functions: environmentReadersSchema})',
            },
        ],
        [
            'architecture',
            {
                schema: z.strictObject({ roles: architectureRolesSchema }),
                expression: 'z.strictObject({roles: architectureRolesSchema})',
            },
        ],
    ]);
    const value = owners.get(namespace ?? '');
    if (value === undefined) return undefined;
    return childSetting(value, keys);
}

function settingChildren<Value>(entries: [string, Value][]) {
    const leaves = new Map<string, Value>();
    const tables = new Map<string, [string, Value][]>();
    for (const [name, value] of entries) {
        const [key, ...remaining] = name.split('.');
        if (key === undefined) throw new Error('A setting must have a name.');
        if (remaining.length === 0) {
            leaves.set(key, value);
            continue;
        }
        const children = tables.get(key) ?? [];
        children.push([remaining.join('.'), value]);
        tables.set(key, children);
    }
    return { leaves, tables };
}

function compileNamespace(entries: [string, CompiledSetting][]): CompiledSetting<z.ZodObject> {
    const { leaves, tables } = settingChildren(entries);
    for (const [name, children] of tables) {
        const base = leaves.get(name);
        const nested = compileNamespace(children);
        leaves.set(
            name,
            base === undefined
                ? nested
                : {
                      schema: z.instanceof(z.ZodObject).parse(base.schema).extend(nested.schema.shape),
                      expression: `${base.expression}.extend(${nested.expression}.shape)`,
                  },
        );
    }
    const fields = [...leaves].map(([name, value]) => `${JSON.stringify(name)}:${value.expression}.optional()`);
    return {
        schema: z.strictObject(Object.fromEntries([...leaves].map(([name, value]) => [name, value.schema.optional()]))),
        expression: 'z.strictObject({' + fields.join(',') + '})',
    };
}

function validateDefaults(declarations: SettingDeclaration[], schema: z.ZodObject): void {
    const defaults = declarations.flatMap((declaration) =>
        Object.entries(declaration)
            .filter(([key, value]) => SETTING_DEFAULT_FIELDS.has(key) && value !== undefined)
            .map(([key, value]) => ({ declaration, key, value })),
    );
    for (const { declaration, key, value: authored } of defaults) {
        const segments = declaration.name.split('.');
        const prefixLength = segments[0] === 'tools' ? TOOL_KEY_DEPTH : 1;
        const value = childSetting({ schema, expression: '' }, [
            segments.slice(0, prefixLength).join('.'),
            ...segments.slice(prefixLength),
        ]);
        if (value === undefined) throw new Error(`No compiled validator owns ${declaration.name}.`);
        const parsed = value.schema.safeParse(authored);
        if (!parsed.success)
            throw new Error(
                parsed.error.issues
                    .map((issue) => `${declaration.name}.${key}.${issue.path.map(String).join('.')}: ${issue.message}`)
                    .join('\n'),
            );
    }
}

function effectiveNamespace(expression: string, required: string[]): string {
    const { leaves, tables: children } = settingChildren(required.map((name) => [name, true]));
    const fields = [...children].map(([key, names]) => {
        const parent = `${expression}.shape[${JSON.stringify(key)}].unwrap()`;
        return `${JSON.stringify(key)}:${effectiveNamespace(
            parent,
            names.map(([name]) => name),
        )}`;
    });
    const requiredFields = [...leaves.keys()].map((name) => `${JSON.stringify(name)}:true`);
    return (
        expression +
        (requiredFields.length === 0 ? '' : `.required({${requiredFields.join(',')}})`) +
        (fields.length === 0 ? '' : `.extend({${fields.join(',')}})`)
    );
}

function requiredSettings(manifests: Manifest[], namespace: string): string[] {
    const available = new Map(manifests.map((manifest) => [manifest.configuration.name, manifest]));
    const prefix = `${namespace}.`;
    const providers = manifests.filter((manifest) =>
        manifest.settings.some((setting) => setting.name.startsWith(prefix)),
    );
    const defaults = providers.map(
        (provider) =>
            new Set(
                selectForScope(
                    { configurations: [provider.configuration.name], removed_configurations: [], scope: {} },
                    '',
                    available,
                ).flatMap((manifest) =>
                    manifest.settings.filter((setting) => setting.default !== undefined).map((setting) => setting.name),
                ),
            ),
    );
    return [...(defaults[0] ?? [])]
        .filter((name) => name.startsWith(prefix) && defaults.every((keys) => keys.has(name)))
        .map((name) => name.slice(prefix.length));
}

function publicToolTables(compiled: Map<string, CompiledSetting<z.ZodObject>>): string[] {
    const namespaces = [...compiled.keys()];
    const tools = [
        ...new Set([
            ...Object.keys(toolsSchema.shape),
            ...namespaces.filter((name) => name.startsWith('tools.')).map((name) => name.slice('tools.'.length)),
        ]),
    ].toSorted((left, right) => left.localeCompare(right));
    return tools.map((tool) => {
        const native = childSetting({ schema: toolsSchema, expression: 'toolsSchema' }, [tool]);
        const key = `tools.${tool}`;
        const namespace = `settingNamespaceSchemas[${JSON.stringify(key)}]`;
        if (native === undefined) return `${JSON.stringify(tool)}:${namespace}.optional()`;
        const table = z.instanceof(z.ZodObject).parse(native.schema);
        const namespaceSchema = compiled.get(key);
        const additions =
            namespaceSchema !== undefined &&
            Object.keys(namespaceSchema.schema.shape).some((field) => !Object.hasOwn(table.shape, field));
        const field = additions
            ? `${native.expression}.extend(${namespace}.shape).optional()`
            : `toolsSchema.shape[${JSON.stringify(tool)}]`;
        return `${JSON.stringify(tool)}:${field}`;
    });
}

function schemaModule(lines: string[]): string {
    return [`// Generated by the policy schema compiler.`, ...lines, ''].join('\n');
}

/**
 * Emit literal validators whose inferred keys and values derive from the shipped declarations.
 * @param declarations the validated manifests and their native requirement graph
 * @returns the compiler-owned module text, without schema-injected policy defaults
 */
export function settingSchemaSources(declarations: Iterable<Manifest>): Map<string, string> {
    const manifests = [...declarations];
    const authored = manifests.flatMap((manifest) => manifest.settings);
    const entries = new Map<string, CompiledSetting>();
    for (const declaration of authored)
        entries.set(declaration.name, nativeSetting(declaration.name) ?? compileSettingValue(declaration));
    const values: string[] = [];
    const namespaces = new Map<string, [string, CompiledSetting][]>();
    for (const [name, value] of [...entries].toSorted(([left], [right]) => left.localeCompare(right))) {
        const segments = name.split('.');
        const prefixLength = segments[0] === 'tools' ? TOOL_KEY_DEPTH : 1;
        const namespace = segments.slice(0, prefixLength).join('.');
        const children = namespaces.get(namespace) ?? [];
        children.push([segments.slice(prefixLength).join('.'), value]);
        namespaces.set(namespace, children);
        const fields = segments
            .slice(prefixLength)
            .map((field) => `.shape[${JSON.stringify(field)}].unwrap()`)
            .join('');
        values.push(`${JSON.stringify(name)}:settingNamespaceSchemas[${JSON.stringify(namespace)}]${fields}`);
    }
    const compiled = new Map([...namespaces].map(([name, children]) => [name, compileNamespace(children)]));
    validateDefaults(
        authored,
        z.strictObject(Object.fromEntries([...compiled].map(([name, value]) => [name, value.schema]))),
    );
    const namespaceSchemas = [...compiled].map(([name, value]) => `${JSON.stringify(name)}:${value.expression}`);
    const configurations = [...namespaces.keys()]
        .filter((name) => !name.includes('.') && !POLICY_TABLE_NAMES.includes(name))
        .map((name) => `${JSON.stringify(name)}:settingNamespaceSchemas[${JSON.stringify(name)}].optional()`);
    const activeSchemas = [...namespaces.keys()].map((name) => {
        const parent = `settingNamespaceSchemas[${JSON.stringify(name)}]`;
        return `${JSON.stringify(name)}:${effectiveNamespace(parent, requiredSettings(manifests, name))}`;
    });
    return new Map([
        [
            SETTING_NAMESPACES_FILE,
            schemaModule([
                ...SETTING_NAMESPACE_IMPORTS,
                `export const settingNamespaceSchemas = {${namespaceSchemas.join(',')}};`,
                `export const publicToolsSchema = z.strictObject({${publicToolTables(compiled).join(',')}});`,
                `export const configurationSettingSchemas = {${configurations.join(',')}};`,
            ]),
        ],
        [
            ACTIVE_SETTINGS_FILE,
            schemaModule([
                "import { z } from 'zod';",
                ...SETTING_SCHEMA_IMPORTS,
                `export const activeSettingNamespaceSchemas = {${activeSchemas.join(',')}};`,
                'export const activeSettingNamespacesSchema = z.strictObject(activeSettingNamespaceSchemas).partial();',
            ]),
        ],
        [
            SETTING_VALUES_FILE,
            schemaModule([...SETTING_SCHEMA_IMPORTS, `export const settingValueSchemas = {${values.join(',')}};`]),
        ],
    ]);
}

// Settings and defaults declared by gspot and selected configurations. Framework, platform, library, and database
// configurations override an earlier scalar default; other scalar disagreements are reported as conflicts.
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { toolsSchema } from '#cli/policy/schema/tools.ts';
import { mergeValue } from '#cli/policy/settings/lookup.ts';
import { TOOL_DEADLINE, OVERRIDING_KINDS } from '#cli/config/policy/settings.ts';
import type { KnownSettings, SettingDefault } from '#cli/types/policy/settings.ts';
import { rootSettingSchemas, tableSettingSchemas } from '#cli/policy/schema/policy.ts';
import type { Level, Manifest, SettingDeclaration } from '#cli/types/configurations.ts';
import { settingTypeSchema, settingItemsSchema } from '#cli/parsers/schema/settings.ts';

// Whether another configuration's scalar default disagrees with this one, and this one may not override it.
function isScalarConflict(previous: SettingDefault, manifest: Manifest, declaration: SettingDeclaration): boolean {
    if (previous.configuration === manifest.configuration.name) return false;
    if (isDeepStrictEqual(previous.value, declaration.default)) return false;
    return !OVERRIDING_KINDS.has(manifest.configuration.kind);
}

function addDefault(surface: KnownSettings, manifest: Manifest, declaration: SettingDeclaration): void {
    if (declaration.default === undefined) return;
    const previous = surface.defaults.get(declaration.name);
    const isList = surface.declarations.get(declaration.name)?.type === 'list';
    if (!isList && previous !== undefined && isScalarConflict(previous, manifest, declaration)) {
        surface.errors.push({
            key: declaration.name,
            message: `The configurations \`${previous.configuration}\` and \`${manifest.configuration.name}\` set \`${declaration.name}\` to different values. Set it yourself in gspot.toml to decide.`,
        });
        return;
    }
    surface.defaults.set(declaration.name, {
        value: isList ? mergeValue(declaration, previous?.value, declaration.default) : declaration.default,
        configuration: manifest.configuration.name,
    });
}

// Adds one configuration's settings and their defaults, then its [defaults] for settings other configurations declare; those apply
// only while such a configuration is selected.
function addManifest(surface: KnownSettings, manifest: Manifest, level: Level): void {
    const isAll = level === 'all';
    for (const declared of manifest.settings) {
        const declaration =
            isAll && declared.default_all !== undefined ? { ...declared, default: declared.default_all } : declared;
        if (!surface.declarations.has(declaration.name)) surface.declarations.set(declaration.name, declaration);
        addDefault(surface, manifest, declaration);
    }
    const overrides = Object.entries({ ...manifest.set, ...(isAll ? manifest.set_all : {}) });
    for (const [name, value] of overrides) addOverride(surface, manifest, name, value);
}

// One [defaults] entry, applied when a selected configuration declares the setting it names.
function addOverride(surface: KnownSettings, manifest: Manifest, name: string, value: unknown): void {
    const declaration = surface.declarations.get(name);
    if (declaration === undefined) return;
    addDefault(surface, manifest, { ...declaration, default: value });
}

// The command value kind comes from the same native input schema that accepts it.
function typeOf(type: z.core.JSONSchema.JSONSchema['type']): SettingDeclaration['type'] {
    if (type === 'array') return 'list';
    if (type === 'object') return 'table';
    return settingTypeSchema.parse(type === 'integer' ? 'number' : type);
}

// Convert each native declaration once, retaining typed record items whose reasons belong to the item.
function declarationOf(schema: z.ZodType): Pick<SettingDeclaration, 'type' | 'items'> {
    const input = z.toJSONSchema(schema, { io: 'input' });
    const type = typeOf(input.type);
    const item = input.items;
    if (typeof item !== 'object' || Array.isArray(item) || item.properties?.['reason'] === undefined) return { type };
    const fields = Object.fromEntries(
        Object.entries(item.properties).map(([name, field]): [string, unknown] => {
            if (typeof field === 'boolean') return [name, field];
            const element = field.items;
            return [
                name,
                {
                    type: typeOf(field.type),
                    optional: item.required?.includes(name) !== true,
                    ...(typeof element !== 'object' || Array.isArray(element)
                        ? {}
                        : {
                              items: element['pathRole'] === undefined ? typeOf(element.type) : 'path',
                          }),
                },
            ];
        }),
    );
    return { type, items: settingItemsSchema.parse(fields) };
}

const rootDeclarations: SettingDeclaration[] = [
    TOOL_DEADLINE,
    ...Object.entries({ ...rootSettingSchemas, ...tableSettingSchemas }).map<SettingDeclaration>(([name, schema]) => {
        const value = schema.parse(schema.meta()?.['default']);
        return {
            name,
            validation: {},
            ...declarationOf(schema),
            direction: 'neutral',
            default: value,
            summary: schema.description ?? '',
        };
    }),
];

const nativeDeclarations = new Map(
    Object.entries(toolsSchema.shape).map(([tool, table]) => [
        tool,
        Object.entries<z.ZodType>(table.unwrap().shape).map<SettingDeclaration>(([field, schema]) => ({
            name: `tools.${tool}.${field}`,
            validation: {},
            ...declarationOf(schema),
            direction: 'neutral',
            summary: schema.description ?? `Native ${tool} ${field.replaceAll('_', ' ')} options.`,
        })),
    ]),
);

/**
 * Builds the surface in selection order; framework, platform, library, and database configurations override scalar defaults.
 * @param selected the manifests of the selection, in order.
 * @param level the enforcement level whose defaults apply.
 * @returns the declarations, their defaults and the conflicts found on the way
 */
export function knownSettings(selected: Manifest[], level: Level = 'recommended'): KnownSettings {
    const surface: KnownSettings = { declarations: new Map(), defaults: new Map(), errors: [] };
    for (const declaration of rootDeclarations) {
        surface.declarations.set(declaration.name, declaration);
        surface.defaults.set(declaration.name, { value: declaration.default, configuration: 'gspot' });
    }
    for (const manifest of selected) addManifest(surface, manifest, level);
    const tools = new Set(selected.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    for (const [tool, declarations] of nativeDeclarations) {
        if (!tools.has(tool)) continue;
        for (const declaration of declarations.filter((entry) => !surface.declarations.has(entry.name)))
            surface.declarations.set(declaration.name, declaration);
    }
    return surface;
}

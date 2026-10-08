// Settings and defaults declared by gspot and selected configurations. Framework, platform, library, and database
// configurations override an earlier scalar default; other scalar disagreements are reported as conflicts.
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { createTable } from '#cli/platform/contracts.ts';
import { toolsSchema } from '#cli/policy/schema/tools.ts';
import { coversScope } from '#cli/repository/paths/public.ts';
import { limitTableSchema } from '#cli/policy/schema/contracts.ts';
import { rootSettingSchemas, tableSettingSchemas } from '#cli/policy/schema/public.ts';
import type { Level, Manifest, SettingDeclaration } from '#cli/types/configurations.ts';
import { settingTypeSchema, settingItemsSchema } from '#cli/parsers/schema/contracts.ts';
import { tablesFor, mergeValue, listSettings, settingValue } from '#cli/policy/settings/contracts.ts';
import { settingValueSchemas, activeSettingNamespacesSchema } from '#cli/policy/schema/native/public.ts';
import { TOOL_DEADLINE, TOOL_KEY_DEPTH, ISO_DATE_LENGTH, OVERRIDING_KINDS } from '#cli/config/policy/settings.ts';

import type {
    Policy,
    ScopeView,
    IgnoreEntry,
    KnownSettings,
    ScopeSelection,
    SettingDefault,
    ResolvedSettings,
} from '#cli/types/policy/settings.ts';

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

/**
 * Select saved ignores whose expiry date has not arrived.
 * @param policy the repository policy, including inactive ignores
 * @returns the ignores that apply today in UTC
 */
export function activeIgnores(policy: Policy): IgnoreEntry[] {
    const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
    return policy.ignore.filter((entry) => entry.until === undefined || today < entry.until.toISOString());
}

/**
 * Builds the merged view for a scope from the surface, the policy and the scope's selection.
 * @param surface the surface of the selection
 * @param policy the policy
 * @param selected the selected manifests
 * @param scope the scope path, '' for the root
 * @returns the view the templates read
 */
export function scopeView(surface: KnownSettings, policy: Policy, selected: Manifest[], scope: string): ScopeView {
    const { settings, values, limits, test_files: testFiles } = effectiveSettings(surface, policy, selected, scope);
    const ignores = activeIgnores(policy).map((entry) => ({ ...entry, paths: entry.paths ?? [] }));
    const format = values.format;
    if (format === undefined) throw new Error('The selected scope has no format settings.');
    return {
        configurations: selected.map((manifest) => manifest.configuration.name),
        test_files: testFiles,
        settings,
        values,
        roles: { ...values.architecture?.roles, tests: values.architecture?.roles.tests ?? testFiles },
        format,
        limit: (key, language) => limits[`${language ?? ''}.${key}`] ?? limits[`.${key}`],
        options: (name) => {
            const value = values[name];
            if (value === undefined) throw new Error(`The selected scope has no ${name} settings.`);
            return value;
        },
        ignoresFor: (check) => ignores.filter((entry) => entry.check === check),
        rulesOff: (check) =>
            ignores
                .filter((entry) => entry.check === check)
                .filter((entry) => entry.paths.length === 0 || coversScope(entry.paths, scope))
                .map((entry) => entry.rule)
                .filter((rule) => rule !== undefined),
        verbatim: (name) => {
            const found = tablesFor(policy, scope)
                .map(({ table }) => table.tools?.[name]?.['verbatim'])
                .filter((value): value is Record<string, unknown> => typeof value === 'object');
            if (found.length === 0) return undefined;
            return Object.fromEntries(found.flatMap((value) => Object.entries(value)));
        },
    };
}

/**
 * Read the merged policy settings of the repository root.
 * @param scopes the command's validated scope selections
 * @returns the root scope's merged view
 */
export function rootView(scopes: ScopeSelection[]): ScopeView {
    const root = scopes.find((selection) => selection.scope.path === '');
    if (root === undefined) throw new Error('The session has no root scope.');
    return root.view;
}

/**
 * Resolve the selected surface once into validated namespace values and numeric limits.
 * @param surface the selected declarations and defaults
 * @param policy the authored repository policy
 * @param selected the selected configurations
 * @param scope the selected scope path
 * @returns typed execution values without adding defaults to authored tables
 */
export function effectiveSettings(
    surface: KnownSettings,
    policy: Policy,
    selected: Manifest[],
    scope: string,
): ResolvedSettings {
    const resolved = listSettings(surface, policy, scope);
    const settings = Object.fromEntries(resolved.map((row) => [row.key, row.value]));
    const namespaces: Record<string, unknown> = {};
    const rows = resolved
        .map((row) => {
            const segments = row.key.split('.');
            const depth = segments[0] === 'tools' ? TOOL_KEY_DEPTH : 1;
            return { row, path: segments.slice(depth, -1), name: segments.slice(0, depth).join('.') };
        })
        .filter(({ row }) => Object.hasOwn(settingValueSchemas, row.declaration.name));
    for (const { row, path, name } of rows) {
        const holder = createTable(namespaces, row.value === undefined ? [name] : [name, ...path]);
        const key = row.key.slice(row.key.lastIndexOf('.') + 1);
        if (holder === undefined) throw new Error(`The setting ${row.key} runs through a non-table value.`);
        if (row.value !== undefined) holder[key] = row.value;
    }
    const declarations = [...surface.declarations.values()].filter(
        (entry) => entry.name.startsWith('limits.') && entry.type === 'number',
    );
    const keys = [...new Set(declarations.map((entry) => entry.name.slice(entry.name.lastIndexOf('.') + 1)))];
    const languages = [
        ...new Set([
            '',
            ...selected.map((manifest) => manifest.configuration.name),
            ...declarations.flatMap((entry) => entry.name.split('.').slice(1, -1)),
            ...tablesFor(policy, scope).flatMap(({ table }) =>
                table.limits === undefined ? [] : Object.keys(table.limits.groups),
            ),
        ]),
    ];
    const limits = limitTableSchema.parse(
        Object.fromEntries(
            keys.flatMap((key) =>
                languages
                    .map((language) => [
                        `${language}.${key}`,
                        settingValue(
                            surface,
                            policy,
                            language === '' ? `limits.${key}` : `limits.${language}.${key}`,
                            scope,
                        )?.value,
                    ])
                    .filter(([, value]) => value !== undefined),
            ),
        ),
    );
    return {
        settings,
        values: activeSettingNamespacesSchema.parse(namespaces),
        limits,
        test_files: rootSettingSchemas.test_files.unwrap().parse(settings['test_files']),
    };
}

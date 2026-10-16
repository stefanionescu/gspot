// Settings and defaults declared by gspot and selected configurations. Framework, platform, library, and database
// configurations override an earlier scalar default; other scalar disagreements produce conflicts.
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { coversScope } from '#cli/repository/scopes.ts';
import { toolsSchema } from '#cli/settings/schema/tools.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import type { IgnoreEntry } from '#cli/types/settings/file.ts';
import { SETTING_LANGUAGES } from '#cli/config/settings/schema.ts';
import type { Level, Manifest } from '#cli/types/configurations.ts';
import type { MemoKey, ReadCache } from '#cli/types/system/files.ts';
import { NAMED_CATEGORIES } from '#cli/config/checks/general/naming.ts';
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';
import { architectureSchema } from '#cli/settings/schema/architecture.ts';
import { rootSettingSchemas, tableSettingSchemas } from '#cli/settings/schema/gspot-toml.ts';
import { tableValuesSchema, configurationTableSchemas } from '#cli/settings/schema/tables.ts';
import { BUILD_SCRIPT, COMMIT_SCOPES, XCODE_DESTINATIONS } from '#cli/config/settings/defaults.ts';
import { ISO_DATE_LENGTH, OVERRIDING_KINDS, GSPOT_DEFAULT_SOURCE } from '#cli/config/settings/values.ts';
import { tablesFor, mergeValue, listSettings, settingValue, fillTableValues } from '#cli/settings/inherit.ts';

import {
    limitTableSchema,
    settingsJsonSchema,
    unwrapSettingSchema,
    namingCategorySchema,
} from '#cli/settings/schema/parts.ts';
import type {
    Settings,
    ScopeView,
    KnownSettings,
    ScopeSettings,
    ScopeSelection,
    SettingDefault,
} from '#cli/types/settings/values.ts';

// Whether another configuration's scalar default disagrees with this one, and this one may not override it.
function isScalarConflict(previous: SettingDefault, manifest: Manifest, declaration: SettingDeclaration): boolean {
    if (previous.configuration === manifest.configuration.name) return false;
    if (isDeepStrictEqual(previous.value, declaration.default)) return false;
    return !OVERRIDING_KINDS.has(manifest.configuration.group);
}

function addDefault(known: KnownSettings, manifest: Manifest, declaration: SettingDeclaration): void {
    if (declaration.default === undefined) return;
    const previous = known.defaults.get(declaration.name);
    const isList = known.declarations.get(declaration.name)?.type === 'list';
    if (!isList && previous !== undefined && isScalarConflict(previous, manifest, declaration)) {
        known.errors.push({
            key: declaration.name,
            message: `The configurations \`${previous.configuration}\` and \`${manifest.configuration.name}\` set \`${declaration.name}\` to different values. Set it yourself in gspot.toml to decide.`,
        });
        return;
    }
    known.defaults.set(declaration.name, {
        value: isList ? mergeValue(declaration, previous?.value, declaration.default) : declaration.default,
        configuration: manifest.configuration.name,
    });
}

// Adds one configuration's settings and their defaults, then its [defaults] for settings other configurations declare; those apply
// only while the selection includes that configuration.
function addManifest(known: KnownSettings, manifest: Manifest, level: Level): void {
    const isAll = level === 'all';
    const declarations = configurationSettings(manifest.configuration.name).map((declared) =>
        isAll && declared.default_all !== undefined ? { ...declared, default: declared.default_all } : declared,
    );
    for (const declaration of declarations) {
        if (!known.declarations.has(declaration.name)) known.declarations.set(declaration.name, declaration);
        addDefault(known, manifest, declaration);
    }
    for (const declaration of declarations.filter((entry) => entry.language_defaults !== undefined)) {
        const [table, field] = declaration.name.split('.');
        const languageDefaults = declaration.language_defaults as NonNullable<SettingDeclaration['language_defaults']>;
        for (const [language, value] of Object.entries(languageDefaults))
            known.defaults.set(`${table as string}.${language}.${field as string}`, {
                value,
                configuration: manifest.configuration.name,
            });
    }
    const overrides = Object.entries(manifest.defaults)
        .map(([name, value]) => ({ declaration: known.declarations.get(name), value }))
        .filter(
            (entry): entry is typeof entry & { declaration: SettingDeclaration } => entry.declaration !== undefined,
        );
    for (const { declaration, value } of overrides) addDefault(known, manifest, { ...declaration, default: value });
}

// The command value kind comes from the same input schema that accepts it.
function typeOf(type: z.core.JSONSchema.JSONSchema['type']): SettingDeclaration['type'] {
    if (type === 'array') return 'list';
    if (type === 'object') return 'table';
    if (type === 'number' || type === 'integer') return 'number';
    if (type === 'string' || type === 'boolean') return type;
    throw new Error(`The setting schema has no supported value type: ${String(type)}.`);
}

function declarationOf(schema: z.ZodType): Pick<SettingDeclaration, 'type' | 'path_role'> {
    const document = settingsJsonSchema(schema);
    const input = document.anyOf?.find((value) => typeof value === 'object' && value.type !== undefined) ?? document;
    const pathRole = input['pathRole'];
    return {
        type: input.type === 'string' && pathRole !== undefined ? 'path' : typeOf(input.type),
        ...(pathRole === 'source' || pathRole === 'destination' ? { path_role: pathRole } : {}),
    };
}

const rootDeclarations: MemoKey<SettingDeclaration[]> = {
    create: () => [
        ...Object.entries({ ...rootSettingSchemas, ...tableSettingSchemas }).map<SettingDeclaration>(
            ([name, schema]) => {
                const value = schema.parse(undefined);
                return {
                    name,
                    ...declarationOf(schema),
                    default: value,
                    summary: schema.description ?? '',
                    ...schema.meta(),
                };
            },
        ),
    ],
};

const toolDeclarations: MemoKey<Map<string, SettingDeclaration[]>> = {
    create: () =>
        new Map(
            Object.entries(toolsSchema.shape).map(([tool, table]) => [
                tool,
                Object.entries<z.ZodType>(table.unwrap().shape).map<SettingDeclaration>(([field, schema]) => ({
                    name: `tools.${tool}.${field}`,
                    ...declarationOf(schema),
                    summary: schema.description ?? '',
                    ...schema.meta(),
                })),
            ]),
        ),
};

/**
 * Builds the known settings in selection order; framework, platform, library, and database configurations override scalar defaults.
 * @param selected the manifests of the selection, in order.
 * @param level the enforcement level whose defaults apply.
 * @param reads the run cache, when a session owns this calculation.
 * @returns the declarations, their defaults and the conflicts found on the way.
 */
function knownSettings(selected: Manifest[], level: Level = 'recommended', reads?: ReadCache): KnownSettings {
    const roots = reads === undefined ? rootDeclarations.create() : getCachedValue(reads, rootDeclarations);
    const declarationsByTool =
        reads === undefined ? toolDeclarations.create() : getCachedValue(reads, toolDeclarations);

    const known: KnownSettings = { declarations: new Map(), defaults: new Map(), errors: [] };
    for (const declaration of roots) {
        known.declarations.set(declaration.name, declaration);
        known.defaults.set(declaration.name, { value: declaration.default, configuration: GSPOT_DEFAULT_SOURCE });
    }
    for (const manifest of selected) addManifest(known, manifest, level);
    const tools = new Set(selected.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    for (const [, declarations] of [...declarationsByTool].filter(([tool]) => tools.has(tool))) {
        for (const declaration of declarations.filter((entry) => !known.declarations.has(entry.name)))
            known.declarations.set(declaration.name, declaration);
    }
    return known;
}

/**
 * Select saved ignores whose expiry date has not arrived.
 * @param settings the repository settings, including inactive ignores.
 * @returns the ignores that apply today in UTC.
 */
function activeIgnores(settings: Settings): IgnoreEntry[] {
    const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
    return settings.ignore.filter((entry) => entry.until === undefined || today < entry.until.toISOString());
}

/**
 * Builds the merged view for a scope from the known settings, the settings and the scope's selection.
 * @param known the known settings of the selection.
 * @param settings the settings.
 * @param selected the selected manifests.
 * @param scope the scope path, '' for the root.
 * @returns the view the templates read.
 */
function scopeView(known: KnownSettings, settings: Settings, selected: Manifest[], scope: string): ScopeView {
    const {
        settings: entries,
        values,
        limits,
        test_files: testFiles,
    } = scopeSettings(known, settings, selected, scope);
    const ignores = activeIgnores(settings).map((entry) => ({ ...entry, paths: entry.paths ?? [] }));
    const format = values.format;
    return {
        configurations: selected.map((manifest) => manifest.configuration.name),
        test_files: testFiles,
        settings: entries,
        values,
        roles: values.architecture?.roles ?? architectureSchema.shape.roles.parse(undefined),
        format,
        limit: (key, language) => {
            const value = limits[`${language ?? ''}.${key}`] ?? limits[`.${key}`];
            if (value === undefined)
                throw new Error(
                    `The selected scope has no ${[language, key].filter((part) => part !== undefined).join('.')} limit.`,
                );
            return value;
        },
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
        extra: (name) => {
            const found = tablesFor(settings, scope)
                .map(({ table }) => table.tools?.[name]?.['extra'])
                .filter((value): value is Record<string, unknown> => typeof value === 'object');
            if (found.length === 0) return undefined;
            return Object.fromEntries(found.flatMap((value) => Object.entries(value)));
        },
    };
}

/**
 * Read the merged settings of the repository root.
 * @param scopes the command's validated scope selections.
 * @returns the root scope's merged view.
 */
function rootView(scopes: ScopeSelection[]): ScopeView {
    const root = scopes.find((selection) => selection.scope.path === '') as ScopeSelection;
    return root.view;
}

/**
 * Resolve the selected known settings once into validated namespace values and numeric limits.
 * @param known the selected declarations and defaults.
 * @param settings the written repository settings.
 * @param selected the selected configurations.
 * @param scope the selected scope path.
 * @returns typed execution values without adding defaults to written tables.
 */
function scopeSettings(known: KnownSettings, settings: Settings, selected: Manifest[], scope: string): ScopeSettings {
    const listed = listSettings(known, settings, scope);
    const entries = Object.fromEntries(listed.map((row) => [row.key, row.value]));
    const namespaces: Record<string, unknown> = {};
    fillTableValues(namespaces, listed);
    const variants = SETTING_LANGUAGES.flatMap((language) =>
        Object.keys(namingCategorySchema.shape).flatMap((field) => [
            `naming.${language}.${field}`,
            ...NAMED_CATEGORIES.map((category) => `naming.${language}.${category}.${field}`),
        ]),
    )
        .filter((key) => !known.declarations.has(key))
        .map((key) => settingValue(known, settings, key, scope))
        .filter((row) => row !== undefined);
    fillTableValues(namespaces, variants);
    const declarations = [...known.declarations.values()].filter(
        (entry) => entry.name.startsWith('limits.') && entry.type === 'number',
    );
    const keys = [...new Set(declarations.map((entry) => entry.name.slice(entry.name.lastIndexOf('.') + 1)))];
    const languages = [
        ...new Set([
            '',
            ...selected.map((manifest) => manifest.configuration.name),
            ...declarations.flatMap((entry) => entry.name.split('.').slice(1, -1)),
            ...tablesFor(settings, scope).flatMap(({ table }) =>
                table.limits === undefined
                    ? []
                    : Object.entries(table.limits)
                          .filter(([, value]) => typeof value === 'object')
                          .map(([language]) => language),
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
                            known,
                            settings,
                            language === '' ? `limits.${key}` : `limits.${language}.${key}`,
                            scope,
                        )?.value,
                    ])
                    .filter(([, value]) => value !== undefined),
            ),
        ),
    );
    return {
        settings: entries,
        values: tableValuesSchema.parse(namespaces),
        limits,
        test_files: rootSettingSchemas.test_files.unwrap().parse(entries['test_files']),
    };
}

/**
 * Shares defaults derived from project inputs between init and a session.
 * @param inputs the npm client, SDK root, and workspace names when detected.
 * @param inputs.npmClient the detected package manager.
 * @param inputs.sdkRoot the detected Xcode SDK.
 * @param inputs.scopes the workspace names.
 * @returns computed setting defaults, with undefined when their project input does not exist.
 */
function detectedDefaults(inputs: { npmClient?: string; sdkRoot?: string; scopes?: string[] }): Map<string, unknown> {
    return new Map<string, unknown>([
        ['site.build_command', inputs.npmClient === undefined ? undefined : [inputs.npmClient, ...BUILD_SCRIPT]],
        ['xcode.destination', XCODE_DESTINATIONS.get(inputs.sdkRoot)],
        [
            'tools.commitlint.scopes',
            inputs.scopes === undefined || inputs.scopes.length === 0
                ? undefined
                : [...inputs.scopes, ...COMMIT_SCOPES],
        ],
    ]);
}

/**
 * Read the declarations and defaults from their authoritative field schemas.
 * @param configuration the configuration that supplies the fields.
 * @returns the setting fields this configuration owns.
 */
function configurationSettings(configuration: string): SettingDeclaration[] {
    const declarations: SettingDeclaration[] = [];
    const visited = new Set<z.ZodType>();
    function fields(schema: z.ZodType, name: string): void {
        if (visited.has(schema)) return;
        visited.add(schema);
        const metadata = schema.meta();
        const owners = metadata?.['configurations'];
        if (Array.isArray(owners) && owners.includes(configuration)) {
            declarations.push({
                name,
                ...declarationOf(schema),
                summary: schema.description ?? '',
                default: schema.parse(undefined),
                ...metadata,
            });
        }
        const inner = unwrapSettingSchema(schema);
        if (inner instanceof z.ZodObject)
            for (const [field, child] of Object.entries(inner.shape)) fields(child as z.ZodType, `${name}.${field}`);
    }
    for (const [name, schema] of Object.entries(configurationTableSchemas)) fields(schema, name);
    for (const [tool, schema] of Object.entries(toolsSchema.shape)) fields(schema, `tools.${tool}`);
    return declarations;
}

export { rootView, scopeView, knownSettings, activeIgnores, detectedDefaults, configurationSettings };

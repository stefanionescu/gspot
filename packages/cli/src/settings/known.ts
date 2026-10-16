import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { mergeValue } from '#cli/settings/inherit.ts';
import { toolsSchema } from '#cli/settings/schema/tools.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { OVERRIDING_KINDS } from '#cli/config/settings/values.ts';
import { buildFilenameMatcher } from '#cli/repository/matchers.ts';
import { unwrapSettingSchema } from '#cli/settings/schema/parts.ts';
import type { Level, Manifest } from '#cli/types/configurations.ts';
import type { MemoKey, ReadCache } from '#cli/types/system/files.ts';
import { rootSettingSchemas } from '#cli/settings/schema/gspot-toml.ts';
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';
import type { KnownSettings, SettingDefault } from '#cli/types/settings/values.ts';
import { tableSettingSchemas, configurationTableSchemas } from '#cli/settings/schema/tables.ts';
import { BUILD_SCRIPT, COMMIT_SCOPES, XCODE_DESTINATIONS } from '#cli/config/settings/defaults.ts';
// Read setting declarations and resolve their shipped and detected defaults.

function getSchemaPathRole(input: z.core.JSONSchema.JSONSchema): unknown {
    if (input['pathRole'] !== undefined) return input['pathRole'];
    if (typeof input.items === 'object' && !Array.isArray(input.items)) return input.items['pathRole'];
    return undefined;
}

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
    const declarations = listConfigurationSettings(manifest.configuration.name).map((declared) =>
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
function convertSchemaType(type: z.core.JSONSchema.JSONSchema['type']): SettingDeclaration['type'] {
    if (type === 'array') return 'list';
    if (type === 'object') return 'table';
    if (['number', 'integer'].includes(type as string)) return 'number';
    if (type === 'string' || type === 'boolean') return type;
    throw new Error(`The setting schema has no supported value type: ${String(type)}.`);
}

function deriveSettingType(schema: z.ZodType): Pick<SettingDeclaration, 'type' | 'path_role'> {
    const document = z.toJSONSchema(schema, { io: 'input' });
    const input = document.anyOf?.find((value) => typeof value === 'object' && value.type !== undefined) ?? document;
    const pathRole = getSchemaPathRole(input);
    return {
        type: input.type === 'string' && pathRole !== undefined ? 'path' : convertSchemaType(input.type),
        ...(['source', 'destination', 'build'].includes(pathRole as string)
            ? { path_role: pathRole as NonNullable<SettingDeclaration['path_role']> }
            : {}),
    };
}

const rootDeclarations: MemoKey<SettingDeclaration[]> = {
    create: () => [
        ...Object.entries({ ...rootSettingSchemas, ...tableSettingSchemas }).map<SettingDeclaration>(
            ([name, schema]) => {
                const value = schema.parse(undefined);
                return {
                    name,
                    ...deriveSettingType(schema),
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
                    ...deriveSettingType(schema),
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
function buildKnownSettings(selected: Manifest[], level: Level = 'recommended', reads?: ReadCache): KnownSettings {
    const roots = reads === undefined ? rootDeclarations.create() : getCachedValue(reads, rootDeclarations);
    const declarationsByTool =
        reads === undefined ? toolDeclarations.create() : getCachedValue(reads, toolDeclarations);

    const known: KnownSettings = { declarations: new Map(), defaults: new Map(), errors: [] };
    for (const declaration of roots) {
        known.declarations.set(declaration.name, declaration);
        known.defaults.set(declaration.name, { value: declaration.default, configuration: 'gspot default' });
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
 * Shares defaults derived from project inputs between init and a session.
 * @param inputs the npm client, SDK root, and workspace names when detected.
 * @param inputs.npmClient the detected package manager.
 * @param inputs.sdkRoot the detected Xcode SDK.
 * @param inputs.scopes the workspace names.
 * @param inputs.openapi the detected OpenAPI filenames and candidate documents.
 * @param inputs.openapi.filenames the filenames that identify an OpenAPI document.
 * @param inputs.openapi.paths the repository-relative paths searched for an OpenAPI document.
 * @returns computed setting defaults, with undefined when their project input does not exist.
 */
function detectDefaults(inputs: {
    npmClient?: string;
    sdkRoot?: string;
    scopes?: string[];
    openapi?: { filenames: string[]; paths: string[] };
}): Map<string, unknown> {
    const matches = inputs.openapi === undefined ? undefined : buildFilenameMatcher(inputs.openapi.filenames);
    const document = inputs.openapi?.paths.find((path) => matches?.(path) === true);
    return new Map<string, unknown>([
        ['openapi.document', document],
        ['site.build_command', inputs.npmClient === undefined ? undefined : [inputs.npmClient, ...BUILD_SCRIPT]],
        ['swift.xcode_destination', XCODE_DESTINATIONS.get(inputs.sdkRoot)],
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
function listConfigurationSettings(configuration: string): SettingDeclaration[] {
    const declarations: SettingDeclaration[] = [];
    const visited = new Set<z.ZodType>();
    function collectDeclarations(schema: z.ZodType, name: string): void {
        if (visited.has(schema)) return;
        visited.add(schema);
        const metadata = schema.meta();
        const owners = metadata?.['configurations'];
        if (Array.isArray(owners) && owners.includes(configuration)) {
            declarations.push({
                name,
                ...deriveSettingType(schema),
                summary: schema.description ?? '',
                default: schema.parse(undefined),
                ...metadata,
            });
        }
        const inner = unwrapSettingSchema(schema);
        if (inner instanceof z.ZodObject)
            for (const [field, child] of Object.entries(inner.shape))
                collectDeclarations(child as z.ZodType, `${name}.${field}`);
    }
    for (const [name, schema] of Object.entries(configurationTableSchemas)) collectDeclarations(schema, name);
    for (const [tool, schema] of Object.entries(toolsSchema.shape)) collectDeclarations(schema, `tools.${tool}`);
    return declarations;
}

export { detectDefaults, buildKnownSettings, listConfigurationSettings };

// Settings and defaults declared by gspot and selected configurations. Framework, platform, library, and database
// configurations override an earlier scalar default; other scalar disagreements are reported as conflicts.
import { isDeepStrictEqual } from 'node:util';
import type { Level } from '#cli/types/rules.ts';
import { isRecord } from '#cli/platform/objects.ts';
import { mergeValue } from '#cli/policy/settings/entries.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import type { Manifest, SettingSpec } from '#cli/types/configurations.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { TOOL_DEADLINE, OVERRIDING_KINDS } from '#cli/config/policy/settings.ts';
import type { TomlTable, KnownSettings, SettingDefault } from '#cli/types/policy/settings.ts';
import { policySchema, rootSettingSchemas, tableSettingSchemas } from '#cli/policy/schema/policy.ts';

// Whether another configuration's scalar default disagrees with this one, and this one may not override it.
function isScalarConflict(previous: SettingDefault, manifest: Manifest, spec: SettingSpec): boolean {
    if (previous.configuration === manifest.configuration.name) return false;
    if (isDeepStrictEqual(previous.value, spec.default)) return false;
    return !OVERRIDING_KINDS.has(manifest.configuration.kind);
}

function addDefault(surface: KnownSettings, manifest: Manifest, spec: SettingSpec): void {
    if (spec.default === undefined) return;
    const previous = surface.defaults.get(spec.name);
    const isList = surface.specs.get(spec.name)?.type === 'list';
    if (!isList && previous !== undefined && isScalarConflict(previous, manifest, spec)) {
        surface.problems.push({
            key: spec.name,
            message: `The configurations \`${previous.configuration}\` and \`${manifest.configuration.name}\` set \`${spec.name}\` to different values. Set it yourself in gspot.toml to decide.`,
        });
        return;
    }
    surface.defaults.set(spec.name, {
        value: isList ? mergeValue(spec, previous?.value, spec.default) : spec.default,
        configuration: manifest.configuration.name,
    });
}

// Adds one configuration's settings and their defaults, then its [defaults] for settings other configurations declare; those apply
// only while such a configuration is selected.
function addManifest(surface: KnownSettings, manifest: Manifest, level: Level): void {
    const isAll = level === 'all';
    for (const declared of manifest.settings) {
        const spec =
            isAll && declared.default_all !== undefined ? { ...declared, default: declared.default_all } : declared;
        if (!surface.specs.has(spec.name)) surface.specs.set(spec.name, spec);
        addDefault(surface, manifest, spec);
    }
    const overrides = Object.entries({ ...manifest.set, ...(isAll ? manifest.set_all : {}) });
    for (const [name, value] of overrides) addOverride(surface, manifest, name, value);
}

// One [defaults] entry, applied when a selected configuration declares the setting it names.
function addOverride(surface: KnownSettings, manifest: Manifest, name: string, value: unknown): void {
    const spec = surface.specs.get(name);
    if (spec === undefined) return;
    addDefault(surface, manifest, { ...spec, default: value });
}

// The kind of a setting from the shape of its default.
function typeOf(value: unknown): SettingSpec['type'] {
    if (Array.isArray(value)) return 'list';
    if (typeof value === 'number') return 'number';
    return typeof value === 'boolean' ? 'boolean' : 'string';
}

const rootSpecs: SettingSpec[] = [
    TOOL_DEADLINE,
    ...Object.entries({ ...rootSettingSchemas, ...tableSettingSchemas }).map<SettingSpec>(([name, schema]) => {
        const value = schema.parse(undefined);
        return {
            name,
            validation: {},
            type: typeOf(value),
            direction: 'neutral',
            default: value,
            summary: schema.description ?? '',
        };
    }),
];

/**
 * Builds the surface in selection order; framework, platform, library, and database configurations override scalar defaults.
 * @param selected the manifests of the selection, in order.
 * @param level the enforcement level whose defaults apply.
 * @returns the specs, their defaults and the conflicts found on the way
 */
export function knownSettings(selected: Manifest[], level: Level = 'recommended'): KnownSettings {
    const surface: KnownSettings = { specs: new Map(), defaults: new Map(), problems: [] };
    for (const spec of rootSpecs) {
        surface.specs.set(spec.name, spec);
        surface.defaults.set(spec.name, { value: spec.default, configuration: 'gspot' });
    }
    for (const manifest of selected) addManifest(surface, manifest, level);
    return surface;
}

/**
 * Resolves policy indentation from authored format values and the format configuration's defaults.
 * @param raw the parsed policy table
 * @returns the indentation of one nested TOML item
 */
export function policyIndent(raw: TomlTable): string {
    const format = isRecord(raw['format']) ? raw['format'] : {};
    const defaults = knownSettings(selectConfigurations(['format'], configurationManifests())).defaults;
    const style = format['indent_style'] ?? defaults.get('format.indent_style')?.value;
    if (style === 'tab') return '\t';
    const width = format['indent_width'] ?? defaults.get('format.indent_width')?.value;
    const validated = policySchema.shape.format.unwrap().shape.indent_width.unwrap().parse(width);
    return ' '.repeat(validated);
}

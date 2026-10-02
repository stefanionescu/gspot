// Settings exposed by gspot and selected manifests. Later kits override defaults, through their own settings or
// through a [defaults] table for settings another kit declares.
import { isDeepStrictEqual } from 'node:util';
import * as messages from '#cli/policy/messages.ts';
import { mergeValue } from '#cli/policy/settings.ts';
import type { Manifest, SettingSpec } from '#cli/types/kits.ts';
import type { ExposedSettings } from '#cli/types/policy/policy.ts';
import { TOOL_DEADLINE, OVERRIDING_KINDS } from '#cli/config/policy/policy.ts';
import { rootSettingSchemas, integrationSettingSchemas } from '#cli/policy/schema.ts';

// Whether another kit's scalar default disagrees with this one, and this one may not override it.
function isScalarConflict(previous: { value: unknown; kit: string }, manifest: Manifest, spec: SettingSpec): boolean {
    if (previous.kit === manifest.kit.name) return false;
    if (isDeepStrictEqual(previous.value, spec.default)) return false;
    return !OVERRIDING_KINDS.has(manifest.kit.kind);
}

function addDefault(surface: ExposedSettings, manifest: Manifest, spec: SettingSpec): void {
    if (spec.default === undefined) return;
    const previous = surface.defaults.get(spec.name);
    const isList = surface.specs.get(spec.name)?.type === 'list';
    if (!isList && previous !== undefined && isScalarConflict(previous, manifest, spec)) {
        surface.problems.push({
            key: spec.name,
            message: messages.conflictingScalars(spec.name, previous.kit, manifest.kit.name),
        });
        return;
    }
    surface.defaults.set(spec.name, {
        value: isList ? mergeValue(spec, previous?.value, spec.default) : spec.default,
        kit: manifest.kit.name,
    });
}

// Adds one kit's settings and their defaults, then its [defaults] for settings other kits declare; those apply
// only while such a kit is selected.
function addManifest(surface: ExposedSettings, manifest: Manifest, level: 'recommended' | 'all'): void {
    const isAll = level === 'all';
    for (const declared of manifest.settings) {
        const spec =
            isAll && declared.default_all !== undefined ? { ...declared, default: declared.default_all } : declared;
        if (!surface.specs.has(spec.name)) surface.specs.set(spec.name, spec);
        addDefault(surface, manifest, spec);
    }
    const overrides = Object.entries({ ...manifest.defaults, ...(isAll ? manifest.defaults_all : {}) });
    for (const [name, value] of overrides) addOverride(surface, manifest, name, value);
}

// One [defaults] entry, applied when a selected kit declares the setting it names.
function addOverride(surface: ExposedSettings, manifest: Manifest, name: string, value: unknown): void {
    const spec = surface.specs.get(name);
    if (spec === undefined) return;
    addDefault(surface, manifest, { ...spec, default: value });
}

// The kind of a setting from the shape of its default.
function typeOf(value: unknown): SettingSpec['type'] {
    if (Array.isArray(value)) return 'list';
    return typeof value === 'boolean' ? 'boolean' : 'string';
}

/**
 * Builds the surface in selection order; framework, platform, library, and database kits override scalar defaults.
 * @param selected the manifests of the selection, in order.
 * @param level the enforcement level whose defaults apply.
 * @returns the specs, their defaults and the conflicts found on the way
 */
export function exposedSettings(selected: Manifest[], level: 'recommended' | 'all' = 'recommended'): ExposedSettings {
    const surface: ExposedSettings = { specs: new Map(), defaults: new Map(), problems: [] };
    for (const spec of [
        TOOL_DEADLINE,
        ...Object.entries({ ...rootSettingSchemas, ...integrationSettingSchemas }).map<SettingSpec>(
            ([name, schema]) => {
                const value = schema.parse(undefined);
                return {
                    name,
                    type: typeOf(value),
                    direction: 'neutral',
                    default: value,
                    summary: schema.description ?? '',
                };
            },
        ),
    ]) {
        surface.specs.set(spec.name, spec);
        surface.defaults.set(spec.name, { value: spec.default, kit: 'gspot' });
    }
    for (const manifest of selected) addManifest(surface, manifest, level);
    return surface;
}

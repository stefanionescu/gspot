// The settings a selection exposes: gspot's own, then each manifest's, with defaults that later configurations may override.
import * as messages from '#cli/policy/messages.ts';
import { mergeValue } from '#cli/policy/settings.ts';
import type { ExposedSettings } from '#cli/types/policy/policy.ts';
import { OVERRIDING_KINDS } from '#cli/constants/policy/policy.ts';
import type { Manifest, SettingSpec } from '#cli/types/configurations.ts';
import { COVERAGE_STRICT, TOOL_DEADLINE } from '#cli/constants/configurations.ts';
import { integrationSettingSchemas, rootSettingSchemas } from '#cli/policy/schema.ts';

// Whether another configuration's scalar default disagrees with this one, and this one may not override it.
function isScalarConflict(
    previous: { value: unknown; configuration: string },
    manifest: Manifest,
    spec: SettingSpec,
): boolean {
    if (previous.configuration === manifest.configuration.name) return false;
    if (JSON.stringify(previous.value) === JSON.stringify(spec.default)) return false;
    return !OVERRIDING_KINDS.has(manifest.configuration.kind);
}

function addDefault(surface: ExposedSettings, manifest: Manifest, spec: SettingSpec): void {
    if (spec.default === undefined) return;
    const previous = surface.defaults.get(spec.name);
    const isList = surface.specs.get(spec.name)?.kind === 'list';
    if (!isList && previous !== undefined && isScalarConflict(previous, manifest, spec)) {
        surface.problems.push({
            key: spec.name,
            message: messages.conflictingScalars(spec.name, previous.configuration, manifest.configuration.name),
        });
        return;
    }
    surface.defaults.set(spec.name, {
        value: isList ? mergeValue(spec, previous?.value, spec.default) : spec.default,
        configuration: manifest.configuration.name,
    });
}

// The kind of a setting from the shape of its default.
function kindOf(value: unknown): SettingSpec['kind'] {
    if (Array.isArray(value)) return 'list';
    return typeof value === 'boolean' ? 'boolean' : 'string';
}

// The settings gspot's own root and integration schemas expose, each with the schema's default.
function schemaSpecs(): SettingSpec[] {
    return Object.entries({ ...rootSettingSchemas, ...integrationSettingSchemas }).map(([name, schema]) => {
        const value = schema.parse(undefined);
        return { name, kind: kindOf(value), direction: 'neutral', default: value, summary: schema.description ?? '' };
    });
}

/**
 * Builds the surface in selection order; framework, platform, library, and database configurations override scalar defaults.
 * @param selected the manifests of the selection, in order
 * @returns the specs, their defaults and the conflicts found on the way
 */
export function exposedSettings(selected: Manifest[]): ExposedSettings {
    const surface: ExposedSettings = { specs: new Map(), defaults: new Map(), problems: [] };
    for (const spec of [TOOL_DEADLINE, COVERAGE_STRICT, ...schemaSpecs()]) {
        surface.specs.set(spec.name, spec);
        surface.defaults.set(spec.name, { value: spec.default, configuration: 'gspot' });
    }
    for (const manifest of selected) {
        for (const spec of manifest.settings) {
            if (!surface.specs.has(spec.name)) surface.specs.set(spec.name, spec);
            addDefault(surface, manifest, spec);
        }
    }
    return surface;
}

// Settings exposed by gspot and selected manifests. Later kits override defaults.
import * as messages from '#cli/policy/messages.ts';
import { mergeValue } from '#cli/policy/settings.ts';
import type { Manifest, SettingSpec } from '#cli/types/kits.ts';
import { OVERRIDING_KINDS } from '#cli/config/policy/policy.ts';
import type { ExposedSettings } from '#cli/types/policy/policy.ts';
import { TOOL_DEADLINE, COVERAGE_STRICT } from '#cli/config/kits.ts';
import { rootSettingSchemas, integrationSettingSchemas } from '#cli/policy/schema.ts';

// Whether another kit's scalar default disagrees with this one, and this one may not override it.
function isScalarConflict(
    previous: { value: unknown; configuration: string },
    manifest: Manifest,
    spec: SettingSpec,
): boolean {
    if (previous.configuration === manifest.kit.name) return false;
    if (JSON.stringify(previous.value) === JSON.stringify(spec.default)) return false;
    return !OVERRIDING_KINDS.has(manifest.kit.kind);
}

function addDefault(surface: ExposedSettings, manifest: Manifest, spec: SettingSpec): void {
    if (spec.default === undefined) return;
    const previous = surface.defaults.get(spec.name);
    const isList = surface.specs.get(spec.name)?.kind === 'list';
    if (!isList && previous !== undefined && isScalarConflict(previous, manifest, spec)) {
        surface.problems.push({
            key: spec.name,
            message: messages.conflictingScalars(spec.name, previous.configuration, manifest.kit.name),
        });
        return;
    }
    surface.defaults.set(spec.name, {
        value: isList ? mergeValue(spec, previous?.value, spec.default) : spec.default,
        configuration: manifest.kit.name,
    });
}

// The kind of a setting from the shape of its default.
function kindOf(value: unknown): SettingSpec['kind'] {
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
        COVERAGE_STRICT,
        ...Object.entries({ ...rootSettingSchemas, ...integrationSettingSchemas }).map<SettingSpec>(
            ([name, schema]) => {
                const value = schema.parse(undefined);
                return {
                    name,
                    kind: kindOf(value),
                    direction: 'neutral',
                    default: value,
                    summary: schema.description ?? '',
                };
            },
        ),
    ]) {
        surface.specs.set(spec.name, spec);
        surface.defaults.set(spec.name, { value: spec.default, configuration: 'gspot' });
    }
    for (const manifest of selected) {
        const settings = manifest.settings.map((declared) => {
            if (level === 'all' && declared.default_all !== undefined)
                return { ...declared, default: declared.default_all };
            return declared;
        });
        for (const spec of settings) {
            if (!surface.specs.has(spec.name)) surface.specs.set(spec.name, spec);
            addDefault(surface, manifest, spec);
        }
    }
    return surface;
}

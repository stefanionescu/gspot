// The list explain <preset> and the docs generator read.
import { presetManifests } from '#cli/presets/read-manifests.ts';
import type { ListingRow, CheckSpec, Manifest } from '#cli/presets/types.ts';

const FORMAT_PREFIX = 'format.';

/**
 * One manifest as a listing row.
 * @param manifest the manifest
 * @returns the row explain and the docs print
 */
export function toRow(manifest: Manifest): ListingRow {
    return {
        name: manifest.preset.name,
        kind: manifest.preset.kind,
        title: manifest.preset.title,
        description: manifest.preset.description,
        requires: manifest.preset.requires,
        tools: manifest.tools.map((tool) => (tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`)),
        checks: manifest.checks.map((check) => ({ check: check.name, stage: check.stage })),
        settings: manifest.settings.map((setting) => setting.name),
        rules: Object.values(manifest.rule_files).flat(),
        default: manifest.preset.default,
        proposed: manifest.preset.proposed,
    };
}

/**
 * Every check across every manifest, by id, with the preset that ships it.
 * @returns the checks by id
 */
export function allChecks(): Map<string, { check: CheckSpec; preset: Manifest }> {
    const checks = new Map<string, { check: CheckSpec; preset: Manifest }>();
    for (const manifest of presetManifests().values())
        for (const check of manifest.checks) {
            if (checks.has(check.name)) throw new Error(`Duplicate check identity: ${check.name}`);
            checks.set(check.name, { check, preset: manifest });
        }
    return checks;
}

/**
 * The shipped formatter settings: the defaults of every `format.*` setting the formatting preset declares.
 * @returns the settings by key, without the `format.` prefix
 */
export function shippedFormat(): Record<string, unknown> {
    const settings = presetManifests().get('formatting')?.settings ?? [];
    return Object.fromEntries(
        settings
            .filter((setting) => setting.name.startsWith(FORMAT_PREFIX) && setting.default !== undefined)
            .map((setting) => [setting.name.slice(FORMAT_PREFIX.length), setting.default]),
    );
}

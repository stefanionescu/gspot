// The list explain <preset> and the docs generator read.
import { presetManifests } from '#cli/presets/read.ts';
import type { ListingRow, CheckSpec, Manifest } from '#types/manifest.ts';

/**
 * One manifest as a listing row.
 * @param manifest the manifest
 * @returns the row explain and the docs print
 */
export function toRow(manifest: Manifest): ListingRow {
    return {
        id: manifest.preset.id,
        kind: manifest.preset.kind,
        title: manifest.preset.title,
        description: manifest.preset.description,
        requires: manifest.preset.requires,
        tools: manifest.tools.map((tool) => (tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`)),
        checks: manifest.checks.map((check) => ({ id: check.id, stage: check.stage })),
        settings: manifest.settings.map((setting) => setting.name),
        rules: Object.values(manifest.rules).flat(),
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
        for (const check of manifest.checks)
            if (!checks.has(check.id)) checks.set(check.id, { check, preset: manifest });
    return checks;
}

// The list explain <preset> and the docs generator read.
import { loadManifests } from '#cli/presets/load.ts';
import type { CheckSpec, Manifest } from '#types/manifest.ts';

export type CatalogRow = {
    id: string;
    kind: string;
    title: string;
    description: string;
    requires: string[];
    tools: string[];
    checks: { id: string; stage: string }[];
    settings: string[];
    rules: string[];
    default: boolean;
    proposed: boolean;
};

/** Every preset as a row, sorted by kind then id. */
export function catalog(): CatalogRow[] {
    const rows: CatalogRow[] = [];
    for (const manifest of loadManifests().values()) rows.push(toRow(manifest));
    return rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

/** One manifest as a catalog row. */
export function toRow(manifest: Manifest): CatalogRow {
    return {
        id: manifest.preset.id,
        kind: manifest.preset.kind,
        title: manifest.preset.title,
        description: manifest.preset.description,
        requires: manifest.preset.requires,
        tools: manifest.tools.map((tool) => (tool.version ? `${tool.name} ${tool.version}` : tool.name)),
        checks: manifest.checks.map((check) => ({ id: check.id, stage: check.stage })),
        settings: manifest.settings.map((setting) => setting.name),
        rules: Object.values(manifest.rules).flat(),
        default: manifest.preset.default,
        proposed: manifest.preset.proposed,
    };
}

/** Every check across every manifest, by id, with the preset that ships it. */
export function allChecks(): Map<string, { check: CheckSpec; preset: Manifest }> {
    const checks = new Map<string, { check: CheckSpec; preset: Manifest }>();
    for (const manifest of loadManifests().values())
        for (const check of manifest.checks)
            if (!checks.has(check.id)) checks.set(check.id, { check, preset: manifest });
    return checks;
}

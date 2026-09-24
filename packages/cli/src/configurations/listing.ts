// The list explain <configuration> and the docs generator read.
import { configurationManifests } from '#cli/configurations/read-manifests.ts';
import type { ListingRow, CheckSpec, Manifest } from '#cli/types/configurations.ts';

const FORMAT_PREFIX = 'format.';

/**
 * One manifest as a listing row.
 * @param manifest the manifest
 * @returns the row explain and the docs print
 */
export function toRow(manifest: Manifest): ListingRow {
    return {
        name: manifest.configuration.name,
        kind: manifest.configuration.kind,
        title: manifest.configuration.title,
        description: manifest.configuration.description,
        requires: manifest.configuration.requires,
        tools: manifest.tools.map((tool) => (tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`)),
        checks: manifest.checks.map((check) => ({ check: check.name, stage: check.stage })),
        settings: manifest.settings.map((setting) => setting.name),
        rules: Object.values(manifest.rule_files).flat(),
        default: manifest.configuration.default,
        proposed: manifest.configuration.proposed,
    };
}

/**
 * Every check across every manifest, by id, with the configuration that ships it.
 * @returns the checks by id
 */
export function allChecks(): Map<string, { check: CheckSpec; configuration: Manifest }> {
    const checks = new Map<string, { check: CheckSpec; configuration: Manifest }>();
    for (const manifest of configurationManifests().values())
        for (const check of manifest.checks) {
            if (manifest.configuration.check_references?.includes(check.name)) continue;
            if (checks.has(check.name)) throw new Error(`Duplicate check identity: ${check.name}`);
            checks.set(check.name, { check, configuration: manifest });
        }
    return checks;
}

/**
 * The shipped formatter settings: the defaults of every `format.*` setting the formatting configuration declares.
 * @returns the settings by key, without the `format.` prefix
 */
export function shippedFormat(): Record<string, unknown> {
    const settings = configurationManifests().get('formatting')?.settings ?? [];
    return Object.fromEntries(
        settings
            .filter((setting) => setting.name.startsWith(FORMAT_PREFIX) && setting.default !== undefined)
            .map((setting) => [setting.name.slice(FORMAT_PREFIX.length), setting.default]),
    );
}

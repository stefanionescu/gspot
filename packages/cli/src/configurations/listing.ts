import { FORMAT_PREFIX } from '#cli/constants/configurations.ts';
import type { Manifest, CheckSpec } from '#cli/types/configurations.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

/**
 * Every check across every manifest, by id, with the configuration that ships it.
 * @returns the checks by id
 */
export function allChecks(): Map<string, { check: CheckSpec; configuration: Manifest }> {
    const checks = new Map<string, { check: CheckSpec; configuration: Manifest }>();
    for (const manifest of configurationManifests().values()) {
        const owned = manifest.checks.filter(
            (check) => manifest.configuration.check_references?.includes(check.name) !== true,
        );
        for (const check of owned) {
            if (checks.has(check.name)) throw new Error(`Duplicate check identity: ${check.name}`);
            checks.set(check.name, { check, configuration: manifest });
        }
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

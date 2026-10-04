// Load the built-in configuration registry and resolve its references once per process.
import { parseManifest } from '#cli/parsers/configurations.ts';
import { allChecks } from '#cli/configurations/declarations.ts';
import { manifestError } from '#cli/configurations/problems.ts';
import { readAsset, listAssets } from '#cli/platform/assets.ts';
import type { Manifest, CheckSpec, ManifestRegistryState } from '#cli/types/configurations.ts';

const state: ManifestRegistryState = { cache: undefined };

// Appends each referenced check, declared by another configuration, to the manifest that references it.
function appendReferences(manifests: Map<string, Manifest>): void {
    const declared = new Map(
        [...manifests.values()].flatMap((manifest) => manifest.checks.map((check) => [check.name, check] as const)),
    );
    for (const manifest of manifests.values())
        for (const reference of new Set(manifest.configuration.borrowed_checks)) {
            const check = declared.get(reference);
            if (check !== undefined) manifest.checks.push(check);
        }
}

// Parses one embedded manifest and registers it under its folder name.
function registerManifest(manifests: Map<string, Manifest>, path: string): void {
    const dir = path.slice(0, -'/manifest.toml'.length);
    const manifest = parseManifest(readAsset(path), dir);
    if (manifests.has(manifest.configuration.name))
        throw manifestError(manifest.configuration.name, ['The configuration name is already registered.']);
    manifests.set(manifest.configuration.name, manifest);
}

/**
 * Every embedded manifest by configuration name. Read once per process.
 * @returns the manifests
 */
export function configurationManifests(): Map<string, Manifest> {
    if (state.cache) return state.cache;
    const manifests = new Map<string, Manifest>();
    // The checks across manifests run at build time and in the tests, not on every start.
    for (const path of listAssets('configurations/'))
        if (path.endsWith('/manifest.toml')) registerManifest(manifests, path);
    appendReferences(manifests);
    state.cache = new Map([...manifests].toSorted(([first], [second]) => first.localeCompare(second)));
    return state.cache;
}

/**
 * Lists bundled check IDs alongside the repository's custom executable check IDs.
 * @param checks the custom checks declared by this repository
 * @returns the available check names
 */
export function knownChecks(checks: readonly Pick<CheckSpec, 'name'>[]): string[] {
    const bundled = [...allChecks(configurationManifests().values()).keys()];
    const authored = checks.map((check) => check.name);
    return [...new Set([...bundled, ...authored])];
}

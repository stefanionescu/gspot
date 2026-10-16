// Selection: the configurations named plus every configuration they require, dependencies first, in order of first mention.
import { GspotError } from '#cli/system/errors.ts';
import { SOURCE_GROUPS } from '#cli/config/configurations.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { type Manifest, type SelectionWalk } from '#cli/types/configurations.ts';
import { unknownConfigurationMessage } from '#cli/configurations/unknown-names.ts';

function visit(walk: SelectionWalk, configurationName: string): void {
    if (walk.seen.has(configurationName)) return;
    walk.seen.add(configurationName);
    const manifest = walk.manifests.get(configurationName);
    if (!manifest) {
        const known = walk.manifests.keys().toArray();
        walk.errors.push(unknownConfigurationMessage(configurationName, known));
        return;
    }
    for (const required of manifest.configuration.requires) visit(walk, required);
    walk.order.push(manifest);
}

/**
 * Resolves configuration names to ordered manifests. Throws an arguments error for unknown configurations.
 * @param configurationNames the requested configuration names.
 * @param manifests every configuration manifest.
 * @returns the manifests, requirements first, in order of first mention.
 */
export function selectConfigurations(configurationNames: string[], manifests: Map<string, Manifest>): Manifest[] {
    const walk: SelectionWalk = { manifests, errors: [], order: [], seen: new Set() };
    for (const configurationName of configurationNames) visit(walk, configurationName);
    if (walk.errors.length > 0) throw new GspotError('arguments', walk.errors.join('\n'));
    return walk.order;
}

/**
 * Language and framework configurations that contribute source to shared checks.
 * @param selected the selected manifests.
 * @returns the source settings owners.
 */
export function sourceConfigurations(selected: Manifest[]): Manifest[] {
    const groups: readonly string[] = SOURCE_GROUPS;
    return selected.filter((manifest) => groups.includes(manifest.configuration.group));
}

/**
 * Every distinct manifest across the scopes, in first-seen order.
 * @param scopes the selected scopes.
 * @returns the manifests.
 */
export function everyManifest(scopes: Pick<ScopeSelection, 'selected'>[]): Manifest[] {
    const seen = new Map<string, Manifest>();
    for (const scope of scopes)
        for (const manifest of scope.selected)
            if (!seen.has(manifest.configuration.name)) seen.set(manifest.configuration.name, manifest);
    return seen.values().toArray();
}

/**
 * Tests whether any resolved scope selects a configuration.
 * @param scopes the validated scope selections
 * @param name the configuration name
 * @returns whether any scope includes the configuration
 */
export function isConfigurationSelected(scopes: Pick<ScopeSelection, 'selected'>[], name: string): boolean {
    return scopes.some((selection) => selection.selected.some((manifest) => manifest.configuration.name === name));
}

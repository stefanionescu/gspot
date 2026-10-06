import { GspotError } from '#cli/platform/errors.ts';
import { scopeAncestors } from '#cli/repository/scopes.ts';
import { unknownConfigurationDiagnostic } from '#cli/configurations/problems.ts';

import type {
    Manifest,
    SelectionWalk,
    ConfigurationSelection,
    SelectedConfigurations,
} from '#cli/types/configurations.ts';

// Selection: the configurations named plus every configuration they require, dependencies first, in order of first mention.

function visit(walk: SelectionWalk, configurationName: string): void {
    if (walk.seen.has(configurationName)) return;
    if (walk.visiting.includes(configurationName)) {
        const chain = [...walk.visiting.slice(walk.visiting.indexOf(configurationName)), configurationName];
        walk.problems.push(
            `The configurations require each other in a circle: ${chain.join(' -> ')}. This is a bug in a configuration manifest.`,
        );
        return;
    }
    const manifest = walk.manifests.get(configurationName);
    if (!manifest) {
        const known = walk.manifests.keys().toArray();
        walk.problems.push(unknownConfigurationDiagnostic(configurationName, known));
        walk.seen.add(configurationName);
        return;
    }
    walk.visiting.push(configurationName);
    for (const required of manifest.configuration.requires) visit(walk, required);
    walk.visiting.pop();
    walk.seen.add(configurationName);
    walk.order.push(manifest);
}

/**
 * The chain of requirements from one configuration to another, without revisiting a declaration.
 * @param target the required configuration.
 * @param from the configuration the chain starts at.
 * @param manifests every configuration manifest.
 * @returns the configuration names along the chain from the starting configuration to the target, or undefined when no chain exists.
 */
export function requireChain(target: string, from: string, manifests: Map<string, Manifest>): string[] | undefined {
    const seen = new Set<string>();
    function search(current: string): string[] | undefined {
        if (current === target) return [current];
        if (seen.has(current)) return undefined;
        seen.add(current);
        for (const required of manifests.get(current)?.configuration.requires ?? []) {
            const rest = search(required);
            if (rest !== undefined) return [current, ...rest];
        }
        return undefined;
    }
    return search(from);
}

/**
 * Resolves configuration names to ordered manifests. Throws GspotError('selection') for unknown configurations or circular requirements.
 * @param configurationNames the requested configuration names.
 * @param manifests every configuration manifest.
 * @returns the manifests, requirements first, in order of first mention.
 */
export function selectConfigurations(configurationNames: string[], manifests: Map<string, Manifest>): Manifest[] {
    const walk: SelectionWalk = { manifests, problems: [], order: [], seen: new Set(), visiting: [] };
    for (const configurationName of configurationNames) visit(walk, configurationName);
    const { problems } = walk;
    if (problems.length > 0) throw new GspotError('selection', [...new Set(problems)]);
    return walk.order;
}

/**
 * The root selection and each ancestor scope selection, deduplicated in order.
 * @param policy the declared selections.
 * @param policy.configurations the configurations the root selects.
 * @param policy.scopes the scopes, each with the configurations it selects.
 * @param scope the scope path.
 * @param manifests every configuration manifest.
 * @returns the manifests in order.
 */
export function selectForScope(
    policy: ConfigurationSelection,
    scope: string,
    manifests: Map<string, Manifest>,
): Manifest[] {
    const automatic = manifests
        .values()
        .filter(
            (manifest) =>
                manifest.configuration.kind === 'general' &&
                manifest.configuration.always_selected &&
                manifest.configuration.when === undefined,
        )
        .map((manifest) => manifest.configuration.name)
        .toArray();
    return selectConfigurations(
        [
            ...policy.configurations,
            ...scopeAncestors(policy.scopes, scope).flatMap((entry) => entry.configurations),
            ...automatic,
        ],
        manifests,
    );
}

/**
 * Language and framework configurations that contribute source to shared checks.
 * @param selected the selected manifests.
 * @returns the source policy owners.
 */
export function sourceConfigurations(selected: Manifest[]): Manifest[] {
    return selected.filter(
        (manifest) => manifest.configuration.kind === 'language' || manifest.configuration.kind === 'framework',
    );
}

/**
 * Every distinct manifest across the scopes, in first-seen order.
 * @param scopes the selected scopes.
 * @returns the manifests.
 */
export function everyManifest(scopes: SelectedConfigurations[]): Manifest[] {
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
 * @returns whether the configuration is selected in at least one scope
 */
export function isConfigurationSelected(scopes: SelectedConfigurations[], name: string): boolean {
    return scopes.some((selection) => selection.selected.some((manifest) => manifest.configuration.name === name));
}

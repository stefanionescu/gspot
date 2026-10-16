import { GspotError } from '#cli/system/errors.ts';
import { SOURCE_FILE_GROUPS } from '#cli/config/configurations.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { formatCodeList, selectSimilarNames } from '#cli/system/text.ts';

import {
    type Manifest,
    type SelectionWalk,
    type UnknownConfiguration,
    type ConfigurationDeclaration,
} from '#cli/types/configurations.ts';

function visit(walk: SelectionWalk, configurationName: string): void {
    if (walk.seen.has(configurationName)) return;
    walk.seen.add(configurationName);
    const manifest = walk.manifests.get(configurationName);
    if (!manifest) {
        const known = walk.manifests.keys().toArray();
        walk.errors.push(formatUnknownConfiguration(configurationName, known));
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
function selectConfigurations(configurationNames: string[], manifests: Map<string, Manifest>): Manifest[] {
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
function filterSourceConfigurations(selected: Manifest[]): Manifest[] {
    const groups: readonly string[] = SOURCE_FILE_GROUPS;
    return selected.filter((manifest) => groups.includes(manifest.configuration.group));
}

/**
 * Every distinct manifest across the scopes, in first-seen order.
 * @param scopes selections whose enabled configuration declarations may overlap.
 * @returns one declaration per configuration name, in first-seen order.
 */
function listSelectedManifests(scopes: Pick<ScopeSelection, 'selected'>[]): Manifest[] {
    const seen = new Map<string, Manifest>();
    for (const scope of scopes)
        for (const manifest of scope.selected)
            if (!seen.has(manifest.configuration.name)) seen.set(manifest.configuration.name, manifest);
    return seen.values().toArray();
}

/**
 * Tests whether any resolved scope selects a configuration.
 * @param scopes the validated scope selections
 * @param name the identifier to find in each scope's enabled configurations.
 * @returns whether any scope includes the configuration
 */
function isConfigurationSelected(scopes: Pick<ScopeSelection, 'selected'>[], name: string): boolean {
    return scopes.some((selection) => selection.selected.some((manifest) => manifest.configuration.name === name));
}

/**
 * Names an unavailable configuration and suggests nearby declared names.
 * @param name the requested configuration
 * @param known the declared configuration names
 * @returns the public diagnostic
 */
function formatUnknownConfiguration(name: string, known: string[]): string {
    const suggestions = selectSimilarNames(name, known);
    return `There is no configuration called \`${name}\`.${suggestions.length > 0 ? ' Did you mean ' + formatCodeList(suggestions) + '?' : ''} Run \`gspot list configurations\` to see the available configurations.`;
}

/**
 * Reports unknown configuration names without losing their declaration order or location.
 * @param declarations the requested names, with their original fields
 * @param manifests the declared configurations
 * @returns each unknown declaration with its public diagnostic
 */
function listUnknownConfigurations<Declaration extends Pick<ConfigurationDeclaration, 'name'>>(
    declarations: readonly Declaration[],
    manifests: ReadonlyMap<string, Manifest>,
): UnknownConfiguration<Declaration>[] {
    const known = [...manifests.keys()];
    return declarations
        .filter(({ name }) => !manifests.has(name))
        .map((declaration) => ({
            ...declaration,
            message: formatUnknownConfiguration(declaration.name, known),
        }));
}

/**
 * Refuse explicit edits to configurations that gspot selects itself.
 * @param names the configuration names
 * @param manifests the configuration declarations
 */
function refuseAlwaysSelected(names: string[], manifests: Map<string, Manifest>): void {
    const name = names.find((entry) => manifests.get(entry)?.configuration.always_selected === true);
    if (name !== undefined)
        throw new GspotError(
            'arguments',
            `gspot selects ${name} by itself when the repository needs it, so you cannot add or remove it. To run more or fewer of its checks, run gspot set level. To turn one check off, run gspot ignore.`,
        );
}

export {
    selectConfigurations,
    refuseAlwaysSelected,
    listSelectedManifests,
    isConfigurationSelected,
    listUnknownConfigurations,
    filterSourceConfigurations,
};

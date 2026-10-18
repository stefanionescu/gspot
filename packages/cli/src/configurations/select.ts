import { GspotError } from '#cli/system/errors.ts';
import { formatUnknownName } from '#cli/system/text.ts';
import { SOURCE_FILE_GROUPS } from '#cli/config/configurations.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';

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
 * Resolve configuration names to manifests in order, and throw for unknown names.
 * @param configurationNames the names to resolve.
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
 * Keep the language and framework configurations that add source files to shared checks.
 * @param selected the manifests in use.
 * @returns the configurations that own source settings.
 */
function filterSourceConfigurations(selected: Manifest[]): Manifest[] {
    const groups: readonly string[] = SOURCE_FILE_GROUPS;
    return selected.filter((manifest) => groups.includes(manifest.configuration.group));
}

/**
 * List each manifest of the scopes once, in first-seen order.
 * @param scopes scope selections that can share configurations.
 * @returns one manifest per configuration name.
 */
function listSelectedManifests(scopes: Pick<ScopeSelection, 'selected'>[]): Manifest[] {
    const seen = new Map<string, Manifest>();
    for (const scope of scopes)
        for (const manifest of scope.selected)
            if (!seen.has(manifest.configuration.name)) seen.set(manifest.configuration.name, manifest);
    return seen.values().toArray();
}

/**
 * Check whether any scope selects a configuration.
 * @param scopes the validated scope selections.
 * @param name the configuration to find.
 * @returns whether any scope includes the configuration.
 */
function isConfigurationSelected(scopes: Pick<ScopeSelection, 'selected'>[], name: string): boolean {
    return scopes.some((selection) => selection.selected.some((manifest) => manifest.configuration.name === name));
}

// Name an unknown configuration, and say where to find the available ones.
function formatUnknownConfiguration(name: string, known: string[]): string {
    return `${formatUnknownName('configuration', name, known)} Run \`gspot list configurations\` to see the available configurations.`;
}

/**
 * Find the unknown configuration names, and keep their order and location.
 * @param declarations the requested names, with their original fields.
 * @param manifests the declared configurations.
 * @returns each unknown declaration with its error message.
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
 * @param names the configurations that the command edits.
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

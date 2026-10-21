import { isInScope } from '#cli/repository/scopes.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { ScopeFolder } from '#cli/types/repository/inventory.ts';
import { type ConfigurationEvidence } from '#cli/types/repository/selection.ts';
import { type ConfigurationSelection } from '#cli/types/settings/inheritance.ts';
import { selectConfigurations, assertKnownConfigurations } from '#cli/configurations/select.ts';

import {
    type SettingsDraft,
    type InitRepository,
    type InitConfigurations,
    type ConfigurationOrigin,
    type ConfigurationChoices,
} from '#cli/types/commands/init.ts';

function findCandidate(init: InitRepository, configurationName: string): Configuration | undefined {
    const configuration = init.configurations.get(configurationName);
    if (!configuration) return undefined;
    if (configuration.when?.git === true && !init.repository.hasGit) return undefined;
    return configuration;
}

function selectRootConfigurations(
    init: InitRepository,
    detected: Pick<ConfigurationEvidence, 'configuration'>[],
): string[] {
    const hasScopes = init.repository.scopeFolders.length > 1;
    const named = init.options.configurations;
    const detectedConfigurations = detected
        .filter((evidence) => {
            const configuration = findCandidate(init, evidence.configuration);
            if (!configuration) return false;
            const { group } = configuration;
            return !hasScopes || group === 'general' || group === 'language';
        })
        .map((evidence) => evidence.configuration);
    return [...new Set(named ?? detectedConfigurations)];
}

function selectScopeConfigurations(init: InitRepository, scope: ScopeFolder, rootNames: string[]): string[] {
    const names = detectConfigurations(init.repository, init.configurations, scope.path)
        .filter((evidence) => {
            const configuration = findCandidate(init, evidence.configuration);
            return configuration !== undefined && configuration.group !== 'general';
        })
        .map((evidence) => evidence.configuration);
    // A language stays out of a scope only while the root keeps it: some source of the language sits outside every scope.
    const atRoot = new Set(rootNames);
    return names.filter((name) => !atRoot.has(name) || init.configurations.get(name)?.group !== 'language');
}

function hasSourceOutsideScopes(init: InitRepository, configuration: Configuration, scopes: ScopeFolder[]): boolean {
    return init.repository.files.some(
        (file) =>
            file.kind === 'source' &&
            scopes.every((scope) => scope.path === '' || !isInScope(file.path, scope.path)) &&
            configuration.files.extensions.some((extension) => file.path.endsWith(extension)),
    );
}

function expandSuggestions(
    names: string[],
    configurations: Map<string, Configuration>,
    detected: Set<string>,
): string[] {
    const suggestions = names.flatMap((name) => configurations.get(name)?.suggests ?? []);
    return [
        ...new Set([
            ...names,
            ...suggestions.filter((name) => {
                const configuration = configurations.get(name);
                // A suggestion without detection rules needs no source match.
                const hasDetection =
                    configuration !== undefined &&
                    Object.values(configuration.detect).some((patterns) => Object.keys(patterns).length > 0);
                return !hasDetection || detected.has(name);
            }),
        ]),
    ];
}

function getConfigurationOrigin(name: string, sources: ConfigurationChoices): ConfigurationOrigin {
    if (sources.named.has(name)) return 'named';
    if (sources.detected.has(name)) return 'detected';
    return sources.written.has(name) ? 'suggested' : 'required';
}

/**
 * Select configurations for init from the files, the named configurations, and the project scopes.
 *
 * @param init what init detected, with the flags.
 * @returns the scopes and the configurations of each.
 */
export function selectForInit(init: InitRepository): InitConfigurations {
    const { repository, configurations, options } = init;
    assertKnownConfigurations(options.configurations ?? [], configurations);
    const scopes = repository.scopeFolders;
    const hasScopes = scopes.length > 1;
    const detected = detectConfigurations(repository, configurations);
    const proposedRoot = selectRootConfigurations(init, detected);
    const scopeConfigurations = new Map<string, string[]>();
    const heldAtRoot = proposedRoot.filter((name) => {
        const configuration = configurations.get(name);
        return configuration?.group !== 'language' || !hasScopes || hasSourceOutsideScopes(init, configuration, scopes);
    });
    for (const scope of scopes)
        if (scope.path !== '') scopeConfigurations.set(scope.path, selectScopeConfigurations(init, scope, heldAtRoot));
    const inScopes = new Set(scopeConfigurations.values().toArray().flat());
    const named = new Set(options.configurations);
    const automatic = new Set(
        [...configurations.values()]
            .filter((configuration) => configuration.group === 'general' && configuration.always_selected)
            .map((configuration) => configuration.name),
    );
    const rootNames = expandSuggestions(
        [...proposedRoot, ...inScopes],
        configurations,
        new Set(detected.map((evidence) => evidence.configuration)),
    ).filter((name) => !inScopes.has(name) && (!automatic.has(name) || named.has(name)));
    const selectedNames = new Set(
        selectConfigurations([...rootNames, ...proposedRoot, ...inScopes], configurations).map(
            (configuration) => configuration.name,
        ),
    );
    const sources = {
        named,
        detected: new Set([...proposedRoot, ...inScopes]),
        written: new Set([...rootNames, ...inScopes]),
    };
    const origins = new Map([...selectedNames].map((name) => [name, getConfigurationOrigin(name, sources)]));
    return { scopes, rootNames, scopeConfigurations, selectedNames, detected, origins };
}

/**
 * Read the configuration choices from the draft.
 *
 * @param draft the choices.
 * @returns the configuration choices for the root and each scope.
 */
export function buildDraftSelection(draft: SettingsDraft): ConfigurationSelection {
    return {
        configurations: draft.configurations,
        removed_configurations: [],
        scopes: Object.fromEntries(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
}

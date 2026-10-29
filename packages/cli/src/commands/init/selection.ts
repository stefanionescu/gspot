import { detectConfigurations } from '#cli/repository/detect.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { ScopeFolder } from '#cli/types/repository/files.ts';
import { isInScope, findScopePath } from '#cli/repository/scopes.ts';
import { type ConfigurationEvidence } from '#cli/types/repository/detect.ts';
import { expandSuggestions, selectConfigurations, assertConfigurationsExist } from '#cli/configurations/select.ts';

import {
    type InitRepository,
    type InitConfigurations,
    type ConfigurationOrigin,
    type ConfigurationChoices,
} from '#cli/types/commands/init.ts';

function findInitConfiguration(init: InitRepository, name: string): Configuration | undefined {
    const configuration = init.configurationsByName.get(name);
    if (!configuration) return undefined;
    return configuration.when?.git === true && !init.repository.hasGit ? undefined : configuration;
}

function selectRootConfigurations(
    init: InitRepository,
    detected: Pick<ConfigurationEvidence, 'configuration'>[],
): string[] {
    const named = init.options.configurations;
    if (named !== undefined) return [...new Set(named)];
    const hasScopes = init.repository.scopeFolders.length > 1;
    const root = selectScopeConfigurations(init, { path: '', origin: 'root', configurations: [] }, []);
    const detectedConfigurations = detected
        .filter((evidence) => {
            const configuration = findInitConfiguration(init, evidence.configuration);
            if (!configuration) return false;
            const { group } = configuration;
            return !hasScopes || group === 'general' || group === 'language' || root.includes(configuration.name);
        })
        .map((evidence) => evidence.configuration);
    return [...new Set(detectedConfigurations)];
}

function selectScopeConfigurations(init: InitRepository, scopeFolder: ScopeFolder, rootNames: string[]): string[] {
    const repository =
        scopeFolder.path === ''
            ? {
                  ...init.repository,
                  files: init.repository.files.filter(
                      (file) => findScopePath(file.path, init.repository.scopeFolders) === '',
                  ),
                  dependencyFiles: init.repository.dependencyFiles.filter(
                      (file) => findScopePath(file.path, init.repository.scopeFolders) === '',
                  ),
              }
            : init.repository;
    const names = detectConfigurations(repository, init.configurationsByName, scopeFolder.path)
        .filter((evidence) => {
            const configuration = findInitConfiguration(init, evidence.configuration);
            return configuration !== undefined && configuration.group !== 'general';
        })
        .map((evidence) => evidence.configuration);
    const atRoot = new Set(rootNames);
    return names.filter((name) => !atRoot.has(name) || init.configurationsByName.get(name)?.group !== 'language');
}

function hasSourceOutsideScopes(
    init: InitRepository,
    configuration: Configuration,
    scopeFolders: ScopeFolder[],
): boolean {
    return init.repository.files.some(
        (file) =>
            file.kind === 'source' &&
            scopeFolders.every((scope) => scope.path === '' || !isInScope(file.path, scope.path)) &&
            configuration.files.extensions.some((extension) => file.path.endsWith(extension)),
    );
}

function getConfigurationOrigin(name: string, sources: ConfigurationChoices): ConfigurationOrigin {
    if (sources.named.has(name)) return 'named';
    if (sources.detected.has(name)) return 'detected';
    return sources.written.has(name) ? 'suggested' : 'required';
}

/**
Select configurations for init from the files, the named configurations, and the project scopes.

@param init what init detected, with the flags.
@returns the scopes and the configurations of each.
*/
export function selectForInit(init: InitRepository): InitConfigurations {
    const { repository, configurationsByName, options } = init;
    assertConfigurationsExist(options.configurations ?? [], configurationsByName);
    const scopes = repository.scopeFolders;
    const hasScopes = scopes.length > 1;
    const detected = detectConfigurations(repository, configurationsByName);
    const proposedRoot = selectRootConfigurations(init, detected);
    const scopeConfigurations = new Map<string, string[]>();
    const heldAtRoot = proposedRoot.filter((name) => {
        const configuration = configurationsByName.get(name);
        return configuration?.group !== 'language' || !hasScopes || hasSourceOutsideScopes(init, configuration, scopes);
    });
    for (const scope of scopes)
        if (scope.path !== '') scopeConfigurations.set(scope.path, selectScopeConfigurations(init, scope, heldAtRoot));
    const inScopes = new Set(scopeConfigurations.values().toArray().flat());
    const named = new Set(options.configurations);
    const automatic = new Set(
        configurationsByName
            .values()
            .filter((configuration) => configuration.group === 'general' && configuration.always_selected)
            .map((configuration) => configuration.name),
    );
    const rootNames = expandSuggestions(
        [...proposedRoot, ...inScopes],
        configurationsByName,
        new Set(detected.map((evidence) => evidence.configuration)),
    ).filter((name) => (!inScopes.has(name) || heldAtRoot.includes(name)) && (!automatic.has(name) || named.has(name)));
    const selectedNames = new Set(
        selectConfigurations([...rootNames, ...proposedRoot, ...inScopes], configurationsByName).map(
            (configuration) => configuration.name,
        ),
    );
    const sources = {
        named,
        detected: new Set([...proposedRoot, ...inScopes]),
        written: new Set([...rootNames, ...inScopes]),
    };
    const origins = new Map([...selectedNames].map((name) => [name, getConfigurationOrigin(name, sources)]));
    return { scopes, rootNames, scopeConfigurations, detected, origins };
}

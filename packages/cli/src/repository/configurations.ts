import type { Session } from '#cli/types/session.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { ScopeFolder } from '#cli/types/repository/files.ts';
import { isInScope, selectScopePath } from '#cli/repository/scopes.ts';
import type { ConfigurationEvidence } from '#cli/types/repository/detect.ts';
import { detectConfigurations, listAutomaticConfigurations } from '#cli/repository/detect.ts';
import { expandSuggestions, selectConfigurations, assertConfigurationsExist } from '#cli/configurations/select.ts';

import type {
    InitRepository,
    InitConfigurations,
    ConfigurationOrigin,
    ConfigurationChoices,
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
    return [...new Set([...(init.options.template?.configurations ?? []), ...detectedConfigurations])].filter(
        (name) => init.options.template?.removed.includes(name) !== true,
    );
}

function selectScopeConfigurations(init: InitRepository, scopeFolder: ScopeFolder, rootNames: string[]): string[] {
    const repository =
        scopeFolder.path === ''
            ? {
                  ...init.repository,
                  files: init.repository.files.filter(
                      (file) => selectScopePath(file.path, init.repository.scopeFolders) === '',
                  ),
                  dependencyFiles: init.repository.dependencyFiles.filter(
                      (file) => selectScopePath(file.path, init.repository.scopeFolders) === '',
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
    return names.filter(
        (name) =>
            (!atRoot.has(name) || init.configurationsByName.get(name)?.group !== 'language') &&
            init.options.template?.removed.includes(name) !== true,
    );
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
    if (sources.template.has(name)) return 'template';
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
    const rootDetected = new Set(selectScopeConfigurations(init, { path: '', origin: 'root', configurations: [] }, []));
    const heldAtRoot = proposedRoot.filter((name) => {
        const configuration = configurationsByName.get(name) as Configuration;
        return (
            configuration.group === 'general' ||
            !hasScopes ||
            rootDetected.has(name) ||
            hasSourceOutsideScopes(init, configuration, scopes)
        );
    });
    for (const scope of scopes)
        if (scope.path !== '') scopeConfigurations.set(scope.path, selectScopeConfigurations(init, scope, heldAtRoot));
    const inScopes = new Set(scopeConfigurations.values().toArray().flat());
    const named = new Set(options.configurations);
    const template = new Set(options.template?.configurations);
    const automatic = new Set(listAutomaticConfigurations(configurationsByName, repository));
    const rootNames = expandSuggestions(
        [...proposedRoot, ...inScopes],
        configurationsByName,
        new Set(detected.map((evidence) => evidence.configuration)),
    ).filter(
        (name) =>
            (!inScopes.has(name) || heldAtRoot.includes(name)) &&
            (!automatic.has(name) || named.has(name) || template.has(name)),
    );
    const selectedNames = new Set(
        selectConfigurations([...rootNames, ...proposedRoot, ...inScopes, ...automatic], configurationsByName).map(
            (configuration) => configuration.name,
        ),
    );
    const sources = {
        named,
        template,
        detected: new Set(detected.map((evidence) => evidence.configuration)),
        written: new Set([...rootNames, ...inScopes]),
    };
    const origins = new Map(
        [...selectedNames].map((name) => [
            name,
            configurationsByName.get(name)?.always_selected === true && !named.has(name) && !template.has(name)
                ? ('always' as const)
                : getConfigurationOrigin(name, sources),
        ]),
    );
    return { scopes, rootNames, scopeConfigurations, detected, origins };
}

/**
Find newly detected configurations in each project scope, respecting removals.

@param session the current repository and authored selections.
@returns new choices and the evidence for each scope.
*/
export function listDetectedAdditions(
    session: Session,
): { scope: string; configurations: string[]; evidence: string[] }[] {
    const proposed = selectForInit({
        repository: session.repository,
        configurationsByName: session.configurationsByName,
        options: {},
    });
    return [
        { scope: '', names: proposed.rootNames },
        ...[...proposed.scopeConfigurations].map(([scope, names]) => ({ scope, names })),
    ].flatMap(({ scope, names }) => {
        const selected = session.scopes.find((each) => each.path === scope)?.configurations ?? [];
        const removed = new Set([
            ...session.settings.removed_configurations,
            ...[...session.settings.scopes]
                .filter(([ancestor]) => isInScope(scope, ancestor))
                .flatMap(([, table]) => table.removed_configurations),
        ]);
        const configurations = names.filter(
            (name) => !removed.has(name) && selected.every((configuration) => configuration.name !== name),
        );
        return configurations.length === 0
            ? []
            : [
                  {
                      scope,
                      configurations,
                      evidence: proposed.detected
                          .filter((match) => configurations.includes(match.configuration))
                          .map((match) => match.evidence),
                  },
              ];
    });
}

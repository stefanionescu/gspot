import { getRequired } from '#cli/system/tables.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { isInScope, selectScopePath } from '#cli/repository/scopes.ts';
import { detectConfigurations, listAutomaticConfigurations } from '#cli/repository/detect.ts';
import { expandSuggestions, selectConfigurations, assertConfigurationsExist } from '#cli/manifests/select.ts';

import type {
    ScopeFolder,
    ConfigurationOrigin,
    ConfigurationRequest,
    ConfigurationChoices,
    ConfigurationEvidence,
    ProposedConfigurations,
    ConfigurationSelection,
} from '#cli/types/repository.ts';

function selectRootConfigurations(
    request: ConfigurationRequest,
    detected: Pick<ConfigurationEvidence, 'configuration'>[],
): string[] {
    const named = request.options.configurations;
    if (named !== undefined) return [...new Set(named)];
    const hasScopes = request.repository.scopeFolders.length > 1;
    const root = selectScopeConfigurations(request, { path: '', origin: 'root', configurations: [] }, []);
    const detectedConfigurations = detected
        .filter((evidence) => {
            const configuration = request.configurationsByName.get(evidence.configuration);
            if (!configuration) return false;
            const { group } = configuration;
            return !hasScopes || group === 'general' || group === 'language' || root.includes(configuration.name);
        })
        .map((evidence) => evidence.configuration);
    return [...new Set([...(request.options.template?.configurations ?? []), ...detectedConfigurations])].filter(
        (name) => request.options.template?.removed.includes(name) !== true,
    );
}

function selectScopeConfigurations(
    request: ConfigurationRequest,
    scopeFolder: ScopeFolder,
    rootNames: string[],
): string[] {
    const repository =
        scopeFolder.path === ''
            ? {
                  ...request.repository,
                  files: request.repository.files.filter(
                      (file) => selectScopePath(file.path, request.repository.scopeFolders) === '',
                  ),
                  dependencyFiles: request.repository.dependencyFiles.filter(
                      (file) => selectScopePath(file.path, request.repository.scopeFolders) === '',
                  ),
              }
            : request.repository;
    const names = detectConfigurations(repository, request.configurationsByName, scopeFolder.path)
        .filter((evidence) => {
            const configuration = request.configurationsByName.get(evidence.configuration);
            return configuration !== undefined && configuration.group !== 'general';
        })
        .map((evidence) => evidence.configuration);
    const atRoot = new Set(rootNames);
    return names.filter(
        (name) =>
            (!atRoot.has(name) || request.configurationsByName.get(name)?.group !== 'language') &&
            request.options.template?.removed.includes(name) !== true,
    );
}

function hasSourceOutsideScopes(
    request: ConfigurationRequest,
    configuration: Configuration,
    scopeFolders: ScopeFolder[],
): boolean {
    return request.repository.files.some(
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
Select configurations from the files, the named configurations, and the project scopes.

@param request the repository, the shipped configurations, and the flags.
*/
export function selectProposedConfigurations(request: ConfigurationRequest): ProposedConfigurations {
    const { repository, configurationsByName, options } = request;
    assertConfigurationsExist(options.configurations ?? [], configurationsByName);
    const scopes = repository.scopeFolders;
    const hasScopes = scopes.length > 1;
    const detected = detectConfigurations(repository, configurationsByName);
    const proposedRoot = selectRootConfigurations(request, detected);
    const scopeConfigurations = new Map<string, string[]>();
    const rootDetected = new Set(
        selectScopeConfigurations(request, { path: '', origin: 'root', configurations: [] }, []),
    );
    const heldAtRoot = proposedRoot.filter((name) => {
        const configuration = getRequired(configurationsByName, name, 'configuration');
        return (
            configuration.group === 'general' ||
            !hasScopes ||
            rootDetected.has(name) ||
            hasSourceOutsideScopes(request, configuration, scopes)
        );
    });
    for (const scope of scopes)
        if (scope.path !== '')
            scopeConfigurations.set(scope.path, selectScopeConfigurations(request, scope, heldAtRoot));
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
*/
export function listDetectedAdditions(
    session: ConfigurationSelection,
): { scope: string; configurations: string[]; evidence: ConfigurationEvidence[] }[] {
    const proposed = selectProposedConfigurations({
        repository: session.repository,
        configurationsByName: readConfigurations(),
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
                      evidence: proposed.detected.filter((match) => configurations.includes(match.configuration)),
                  },
              ];
    });
}

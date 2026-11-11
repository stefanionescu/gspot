import { readConfigurations } from '#cli/manifests/read.ts';
import { assertConfigurationsExist, expandSuggestions, selectConfigurations } from '#cli/manifests/select.ts';
import { detectConfigurations, listAutomaticConfigurations } from '#cli/repository/detect.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import { isInScope } from '#cli/system/paths.ts';
import { getRequired } from '#cli/system/tables.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type {
    ConfigurationChoices,
    ConfigurationEvidence,
    ConfigurationOrigin,
    ConfigurationSelection,
    ProposedConfigurations,
    Repository,
    ScopeFolder,
} from '#cli/types/repository.ts';

type ConfigurationRequest = {
    repository: Repository;
    options: {
        configurations?: string[] | undefined;
        template?: { configurations: string[]; removed: string[] } | undefined;
    };
};

function selectRootConfigurations(request: ConfigurationRequest, detected: ConfigurationEvidence[]): string[] {
    const named = request.options.configurations;
    if (named !== undefined) return [...new Set(named)];
    const hasScopes = request.repository.scopeFolders.length > 1;
    const root = selectScopeConfigurations(request, { path: '', origin: 'root', configurations: [] }, []);
    const detectedConfigurations = detected
        .map((evidence) => evidence.configuration)
        .filter(({ name, group }) => !hasScopes || group === 'general' || group === 'language' || root.includes(name))
        .map(({ name }) => name);
    return [...new Set([...(request.options.template?.configurations ?? []), ...detectedConfigurations])].filter(
        (name) => request.options.template?.removed.includes(name) !== true,
    );
}

/**
Detect the configurations of one scope from its own files. The root owns the files outside every scope folder.
*/
function detectScopeConfigurations(repository: Repository, scopePath: string): ConfigurationEvidence[] {
    if (scopePath !== '') return detectConfigurations(repository, scopePath);
    return detectConfigurations({
        ...repository,
        files: repository.files.filter((file) => selectScopePath(file.path, repository.scopeFolders) === ''),
        dependencyFiles: repository.dependencyFiles.filter(
            (file) => selectScopePath(file.path, repository.scopeFolders) === '',
        ),
    });
}

function selectScopeConfigurations(
    request: ConfigurationRequest,
    scopeFolder: ScopeFolder,
    rootNames: string[],
): string[] {
    const atRoot = new Set(rootNames);
    return detectScopeConfigurations(request.repository, scopeFolder.path)
        .map((evidence) => evidence.configuration)
        .filter(
            ({ name, group, always_selected }) =>
                group !== 'general' &&
                !always_selected &&
                (!atRoot.has(name) || group !== 'language') &&
                request.options.template?.removed.includes(name) !== true,
        )
        .map(({ name }) => name);
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

export function selectProposedConfigurations(request: ConfigurationRequest): ProposedConfigurations {
    const { repository, options } = request;
    assertConfigurationsExist(options.configurations ?? []);
    const scopes = repository.scopeFolders;
    const hasScopes = scopes.length > 1;
    const detected = detectConfigurations(repository);
    const detectedNames = new Set(detected.map((evidence) => evidence.configuration.name));
    const proposedRoot = selectRootConfigurations(request, detected);
    const scopeConfigurations = new Map<string, string[]>();
    const rootDetected = new Set(
        selectScopeConfigurations(request, { path: '', origin: 'root', configurations: [] }, []),
    );
    const heldAtRoot = proposedRoot.filter((name) => {
        const configuration = getRequired(readConfigurations(), name, 'configuration');
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
    const automatic = new Set(listAutomaticConfigurations(repository));
    const rootNames = expandSuggestions([...proposedRoot, ...inScopes], detectedNames).filter(
        (name) =>
            (!inScopes.has(name) || heldAtRoot.includes(name)) &&
            (!automatic.has(name) || named.has(name) || template.has(name)),
    );
    const sources = { named, template, detected: detectedNames, written: new Set([...rootNames, ...inScopes]) };
    const origins = new Map(
        selectConfigurations([...rootNames, ...proposedRoot, ...inScopes, ...automatic]).map(
            ({ name, always_selected }) => [
                name,
                always_selected && !named.has(name) && !template.has(name)
                    ? ('always' as const)
                    : getConfigurationOrigin(name, sources),
            ],
        ),
    );
    return { scopes, rootNames, scopeConfigurations, detected, origins };
}

/**
List the configurations that the files suggest and that no scope selects or removes. Each one carries the evidence
of the scope that it belongs to. A configuration that the root holds for a file inside a scope folder keeps the
evidence of the whole repository.
*/
export function listDetectedAdditions(
    session: ConfigurationSelection,
): Array<{ scopePath: string; configurations: string[]; evidence: ConfigurationEvidence[] }> {
    const proposed = selectProposedConfigurations({ repository: session.repository, options: {} });
    return [
        { scopePath: '', names: proposed.rootNames },
        ...[...proposed.scopeConfigurations].map(([scopePath, names]) => ({ scopePath, names })),
    ].flatMap(({ scopePath, names }) => {
        const selected = session.scopes.find((each) => each.path === scopePath)?.configurations ?? [];
        const removed = new Set([
            ...session.settings.removed_configurations,
            ...[...session.settings.scopes]
                .filter(([ancestor]) => isInScope(scopePath, ancestor))
                .flatMap(([, table]) => table.removed_configurations),
        ]);
        const configurations = names.filter(
            (name) => !removed.has(name) && selected.every((configuration) => configuration.name !== name),
        );
        if (configurations.length === 0) return [];
        const own = detectScopeConfigurations(session.repository, scopePath);
        const evidence = proposed.detected
            .filter((match) => configurations.includes(match.configuration.name))
            .map((match) => own.find((found) => found.configuration.name === match.configuration.name) ?? match);
        return [{ scopePath, configurations, evidence }];
    });
}

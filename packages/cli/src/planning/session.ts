import { readSettings } from '#cli/settings/read.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { readSettingsFile } from '#cli/settings/file.ts';
import type { RunCache } from '#cli/types/system/cache.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listEnabledChecks } from '#cli/planning/checks.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { listToolProjectPins } from '#cli/manifests/tools.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import { selectToolConfigurations } from '#cli/planning/tools.ts';
import type { Session, SessionOptions } from '#cli/types/session.ts';
import type { RepositoryListing } from '#cli/types/repository/read.ts';
import { listAutomaticConfigurations } from '#cli/repository/detect.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { selectForScope, buildScopeSettings } from '#cli/settings/scopes.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';
import { listConfigurationGeneratedPaths } from '#cli/repository/files/classify.ts';
import type { PackageManagerPin } from '#cli/types/repository/npm/package-manager.ts';
import { mergeDetectedDefaults, buildAvailableSettings } from '#cli/settings/available.ts';
import { selectStartRunner, detectPackageManager } from '#cli/repository/npm/package-manager.ts';

function buildScopes(
    settings: Settings,
    repository: Repository,
    configurationsByName: Map<string, Configuration>,
    readPackageManager: () => PackageManagerPin,
): Scope[] {
    const { scopeFolders } = repository;
    const automatic = listAutomaticConfigurations(configurationsByName, repository);
    const active = { ...settings, configurations: [...new Set([...settings.configurations, ...automatic])] };
    return scopeFolders.map((scope) => {
        const selected = selectForScope(active, scope.path, configurationsByName);
        const available = buildAvailableSettings(selected, settings.level);
        const packageManager = available.defaults.has('site.build_command') ? readPackageManager() : undefined;
        mergeDetectedDefaults(available, {
            packageManagerName: packageManager?.name,
            dependencyNames: listProjectDependencyNames(repository.dependencyFiles, scope.path),
        });
        const scopeSettings = buildScopeSettings(available, active, selected, scope.path);
        return {
            path: scope.path,
            origin: scope.origin,
            configurations: selected,
            availableSettings: available,
            settings: scopeSettings,
        };
    });
}

async function readSessionRepository({
    settings,
    configurationsByName,
    cache,
    listing,
}: {
    settings: Settings;
    configurationsByName: Map<string, Configuration>;
    cache: RunCache;
    listing: RepositoryListing;
}): Promise<Repository> {
    const selected = new Map(
        ['', ...settings.scopes.keys()].map((path) => [path, selectForScope(settings, path, configurationsByName)]),
    );
    return readRepository(cache, listing, {
        generatedPaths: listConfigurationGeneratedPaths(selected),
        scopes: [...settings.scopes].map(([path, scope]) => ({
            path,
            configurations: scope.configurations,
        })),
        configurationsByName,
    });
}

/**
Refuse invalid settings or configuration choices.

@param root the repository root.
@param options where the tools sit, and what the run already read.
@param options.toolsRoot the working repository with the installed tools.
@param options.cache the run cache.
@param options.listing the files of the repository, or none to list them.
@param options.settingsFile the settings to use, or none to read them from the repository.
@param options.resources the cleanup stack of the caller.
@param options.cancelSignal stops the operations of this session.
*/
export async function openSession(
    root: string,
    {
        toolsRoot = root,
        cache = createRunCache(root),
        listing,
        settingsFile: requestedSettings,
        resources = new DisposableStack(),
        cancelSignal,
    }: SessionOptions = {},
): Promise<Session> {
    let settingsFile = requestedSettings;
    if (settingsFile === undefined) {
        const { text } = readSettingsFile(root);
        settingsFile = { text, settings: readSettings(text, root) };
    }
    const configurationsByName = readConfigurations();
    const settings = settingsFile.settings;
    const repository = await readSessionRepository({
        settings,
        configurationsByName,
        cache,
        listing: listing ?? (await listRepositoryFiles(cache)),
    });
    let pin: PackageManagerPin | undefined;
    const readPackageManager = () =>
        (pin ??= detectPackageManager(
            root,
            repository.files.filter((file) => file.kind === 'source').map((file) => file.path),
        ));
    const scopes = buildScopes(settings, repository, configurationsByName, readPackageManager);
    const session: Session = {
        toolConfigurations: [],
        configuredChecks: listEnabledChecks(scopes, settings),
        resources,
        cancelSignal,
        timeoutSeconds: settings.tool_timeout_seconds,
        packageManager: undefined,
        root,
        toolsRoot,
        startRunner: selectStartRunner(root),
        settings: settingsFile.settings,
        settingsText: settingsFile.text,
        configurationsByName,
        repository,
        scopes,
        inspections: new Map(),
        cache,
    };
    session.toolConfigurations = selectToolConfigurations(session, session.configuredChecks);
    if (Object.keys(listToolProjectPins(session.toolConfigurations).npm).length > 0)
        session.packageManager = readPackageManager();
    return session;
}

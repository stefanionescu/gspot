import { planChecks } from '#cli/planning/checks.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { readSettingsFile } from '#cli/settings/file.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import { selectToolConfigurations } from '#cli/planning/tools.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import type { Session, SessionOptions } from '#cli/types/session.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { RepositoryListing } from '#cli/types/repository/read.ts';
import { listAutomaticConfigurations } from '#cli/repository/detect.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { selectForScope, buildScopeSettings } from '#cli/settings/scopes.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';
import { listConfigurationGeneratedPaths } from '#cli/repository/files/classify.ts';
import type { PackageManagerPin } from '#cli/types/repository/npm/package-manager.ts';
import { applyDetectedDefaults, buildAvailableSettings } from '#cli/settings/available.ts';
import { selectStartRunner, detectPackageManager } from '#cli/repository/npm/package-manager.ts';

function buildScopes(
    settings: Settings,
    repository: Repository,
    configurations: Map<string, Configuration>,
    readPackageManager: () => PackageManagerPin,
): Scope[] {
    const { scopeFolders } = repository;
    const automatic = listAutomaticConfigurations(configurations, repository);
    const active = { ...settings, configurations: [...new Set([...settings.configurations, ...automatic])] };
    return scopeFolders.map((scope) => {
        const selected = selectForScope(active, scope.path, configurations);
        const available = buildAvailableSettings(selected, settings.level);
        const packageManager = available.defaults.has('site.build_command') ? readPackageManager() : undefined;
        applyDetectedDefaults(available, {
            packageManagerName: packageManager?.name,
            dependencyNames: listProjectDependencyNames(repository.dependencyFiles, scope.path),
        });
        const scopeSettings = buildScopeSettings(available, active, selected, scope.path);
        return { folder: scope, configurations: selected, availableSettings: available, settings: scopeSettings };
    });
}

/**
Classify the listed files of the repository from the authored settings and scopes.

@param input the inputs of the repository read.
@param input.settings the authored settings and scope configuration.
@param input.configurations the shipped configuration declarations.
@param input.reads the current repository cache and root folder.
@param input.listing the files of the repository.
@returns the inventory used both before and after fixes.
*/
export async function readSessionRepository({
    settings,
    configurations,
    reads,
    listing,
}: {
    settings: Settings;
    configurations: Map<string, Configuration>;
    reads: ReadCache;
    listing: RepositoryListing;
}): Promise<Repository> {
    const selected = new Map(
        ['', ...Object.keys(settings.scopes)].map((path) => [path, selectForScope(settings, path, configurations)]),
    );
    return readRepository(reads, listing, {
        generatedPaths: listConfigurationGeneratedPaths(selected),
        scopes: Object.entries(settings.scopes).map(([path, scope]) => ({
            path,
            configurations: scope.configurations,
        })),
        configurations,
    });
}

/**
Open a repository session. Refuse invalid settings or configuration choices.

@param rootPath the repository root.
@param options where the tools sit, and what the run already read.
@param options.installedRoot the working repository with the installed tools.
@param options.reads the run cache.
@param options.listing the files of the repository, or none to list them.
@param options.settingsFile the settings to use, or none to read them from the repository.
@param options.resources the cleanup stack of the caller.
@param options.cancelSignal stops the operations of this session.
@returns the validated session.
*/
export async function openSession(
    rootPath: string,
    {
        installedRoot = rootPath,
        reads = createReadCache(rootPath),
        listing,
        settingsFile: requestedSettings,
        resources = new DisposableStack(),
        cancelSignal,
    }: SessionOptions = {},
): Promise<Session> {
    let settingsFile = requestedSettings;
    if (settingsFile === undefined) {
        const { text } = readSettingsFile(rootPath);
        settingsFile = { text, settings: parseSettings(text, rootPath) };
    }
    const root = reads.root;
    const configurations = readConfigurations();
    const settings = settingsFile.settings;
    const repository = await readSessionRepository({
        settings,
        configurations,
        reads,
        listing: listing ?? (await listRepositoryFiles(reads)),
    });
    let pin: PackageManagerPin | undefined;
    const readPackageManager = () =>
        (pin ??= detectPackageManager(
            root,
            repository.files.filter((file) => file.kind === 'source').map((file) => file.path),
        ));
    const scopes = buildScopes(settings, repository, configurations, readPackageManager);
    const session: Session = {
        toolConfigurations: [],
        configuredChecks: [],
        resources,
        cancelSignal,
        timeoutSeconds: settings.tool_timeout_seconds,
        packageManager: undefined,
        root,
        installedRoot,
        startRunner: selectStartRunner(root),
        settingsFile,
        configurations,
        repository,
        scopes,
        inspections: new Map(),
        reads,
    };
    session.configuredChecks = planChecks(session, { stage: 'any', forConfiguration: true }).filter(
        (check) => check.skip === undefined,
    );
    session.toolConfigurations = selectToolConfigurations(session, session.configuredChecks);
    if (Object.keys(listToolProjectPins(session.toolConfigurations).npm).length > 0)
        session.packageManager = readPackageManager();
    return session;
}

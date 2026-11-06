import { listEnabledChecks } from '#cli/engine/plan.ts';
import { pinProjectTypescript, selectToolConfigurations } from '#cli/engine/tools.ts';
import { listAutomaticConfigurations } from '#cli/repository/detect.ts';
import { listConfigurationGeneratedPaths } from '#cli/repository/files/classify.ts';
import { detectPackageManager, selectStartRunner } from '#cli/repository/javascript/package-manager.ts';
import { listRepositoryFiles, readRepository } from '#cli/repository/read.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { readSettingsText } from '#cli/settings/file.ts';
import { readSettings } from '#cli/settings/read.ts';
import { buildScopeSettings, selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { downloadSwiftGrammar } from '#cli/tools/installers/grammars.ts';
import { listPackagePins } from '#cli/tools/pins.ts';
import type { SessionOptions } from '#cli/types/engine/plan.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { Repository, RepositoryListing, UntrackedFiles } from '#cli/types/repository.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import type { RunCache } from '#cli/types/system.ts';
import type { Session, SessionBase } from '#cli/types/tools.ts';

function buildScopes(settings: Settings, repository: Repository): Scope[] {
    const { scopeFolders } = repository;
    const automatic = listAutomaticConfigurations(repository);
    const active = { ...settings, configurations: [...new Set([...settings.configurations, ...automatic])] };
    return scopeFolders.map((scope) => {
        const selected = selectConfigurationsForScope(active, scope.path);
        const available = buildAvailableSettings(selected, settings.level);
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
    cache,
    listing,
    untracked,
    unreadablePaths,
    cancelSignal,
}: {
    settings: Settings;
    cache: RunCache;
    listing: RepositoryListing | undefined;
    untracked: UntrackedFiles | undefined;
    unreadablePaths: string[];
    cancelSignal: AbortSignal | undefined;
}): Promise<Repository> {
    const listed = listing ?? (await listRepositoryFiles(cache, untracked));
    await downloadSwiftGrammar(listed, { settings, cancelSignal });
    const selected = new Map(
        ['', ...settings.scopes.keys()].map((path) => [path, selectConfigurationsForScope(settings, path)]),
    );
    return readRepository(
        cache,
        { ...listed, unreadablePaths: [...listed.unreadablePaths, ...unreadablePaths] },
        {
            generatedPaths: listConfigurationGeneratedPaths(selected),
            scopes: [...settings.scopes].map(([path, scope]) => ({
                path,
                configurations: scope.configurations,
            })),
        },
    );
}

function selectPackageManagers(
    base: SessionBase,
    toolConfigurations: Configuration[],
): Pick<Session, 'packageManager' | 'toolPackageManager'> {
    if (Object.keys(listPackagePins(toolConfigurations).npm).length === 0)
        return { packageManager: undefined, toolPackageManager: undefined };
    const sources = base.repository.files.filter((file) => file.kind === 'source').map((file) => file.path);
    const packageManager = detectPackageManager(base.root, sources);
    return { packageManager, toolPackageManager: packageManager.name === 'yarn' ? 'npm' : packageManager.name };
}

/**
Read the settings and files of a repository, and build its scopes, checks, and tool configurations. Refuse invalid
settings or configuration choices.

@param root the repository root.
@param options where the tools sit, and what the run already read.
@param options.toolsRoot the working repository with the installed tools.
@param options.cache the run cache.
@param options.toolCache the cache of the tool lookups, which pushed revisions and a --fix session share.
@param options.listing the files of the repository, or none to list them.
@param options.untracked the untracked files that a status read of this run found, or none to list them.
@param options.settings the settings to use, or none to read them from the repository.
@param options.unreadablePaths the paths of a copy with names outside UTF-8.
@param options.resources the resources that the caller disposes when the run ends.
@param options.cancelSignal stops the operations of this session.
*/
export async function openSession(
    root: string,
    {
        toolsRoot = root,
        cache = createRunCache(root),
        toolCache = createRunCache(toolsRoot),
        listing,
        untracked,
        settings = readSettings(readSettingsText(root).text, root),
        unreadablePaths = [],
        resources = [],
        cancelSignal,
    }: SessionOptions = {},
): Promise<Session> {
    const repository = await readSessionRepository({
        settings,
        cache,
        listing,
        untracked,
        unreadablePaths,
        cancelSignal,
    });
    const scopes = buildScopes(settings, repository);
    const configuredChecks = listEnabledChecks(scopes, settings);
    const base: SessionBase = {
        configuredChecks,
        resources,
        cancelSignal,
        root,
        toolsRoot,
        startRunner: selectStartRunner(root),
        settings,
        repository,
        scopes,
        cache,
        toolCache,
    };
    const toolConfigurations = pinProjectTypescript(selectToolConfigurations(base, configuredChecks), base);
    return { ...base, toolConfigurations, ...selectPackageManagers(base, toolConfigurations) };
}

import { readSettings } from '#cli/settings/read.ts';
import type { Session } from '#cli/types/session.ts';
import { readRepository } from '#cli/repository/read.ts';
import { SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { isActive, planChecks } from '#cli/planning/checks.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { Settings, SettingsFile } from '#cli/types/settings/file.ts';
import { selectNeededConfigurations } from '#cli/planning/needed-tools.ts';
import { listToolProjectPins } from '#cli/configurations/declared-tools.ts';
import { listAutomaticConfigurations } from '#cli/configurations/select.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import type { PackageManagerPin } from '#cli/types/repository/package-manager.ts';
import { buildKnownSettings, applyDetectedDefaults } from '#cli/settings/known.ts';
import { selectStartRunner, detectPackageManager } from '#cli/repository/npm/package-manager.ts';
import { classifyFile, listConfigurationGeneratedPaths } from '#cli/repository/files/classify.ts';
import { findRootScope, selectForScope, buildScopeSettings } from '#cli/settings/scope-settings.ts';

// Resolve every scope: its folder, configurations, known settings, and merged settings.
async function buildScopes(
    settings: Settings,
    repository: Repository,
    configurations: Map<string, Configuration>,
    readPackageManager: () => Promise<PackageManagerPin>,
): Promise<Scope[]> {
    const { scopeFolders: scopes } = repository;
    const automatic = listAutomaticConfigurations(configurations, repository);
    const effective = { ...settings, configurations: [...new Set([...settings.configurations, ...automatic])] };
    return await Promise.all(
        scopes.map(async (scope) => {
            const selected = selectForScope(effective, scope.path, configurations);
            const known = buildKnownSettings(selected, settings.level);
            const packageManager = known.defaults.has('site.build_command') ? await readPackageManager() : undefined;
            applyDetectedDefaults(known, {
                packageManagerName: packageManager?.name,
                dependencyNames: listProjectDependencyNames(repository.dependencyFiles, scope.path),
            });
            const view = buildScopeSettings(known, effective, selected, scope.path);
            return { folder: scope, configurations: selected, knownSettings: known, settings: view };
        }),
    );
}

// Read the file declarations, and include settings that init has not written yet.
/**
 * Read and classify the repository from the authored settings and scopes.
 *
 * @param input the inputs of the initial repository read.
 * @param input.settings the authored settings and scope configuration.
 * @param input.text the original gspot.toml text.
 * @param input.configurations the shipped configuration declarations.
 * @param input.reads the current repository cache and root folder.
 * @returns the inventory used both before and after fixes.
 */
export async function readSessionRepository({
    settings,
    text,
    configurations,
    reads,
}: {
    settings: Settings;
    text: SettingsFile['text'];
    configurations: Map<string, Configuration>;
    reads: ReadCache;
}): Promise<Repository> {
    const selected = new Map(
        ['', ...Object.keys(settings.scopes)].map((path) => [path, selectForScope(settings, path, configurations)]),
    );
    const generatedPaths = listConfigurationGeneratedPaths(selected);
    const repository = await readRepository(reads, {
        generatedPaths,
        scopes: Object.entries(settings.scopes).map(([path, scope]) => ({
            path,
            configurations: scope.configurations,
        })),
        configurations,
    });
    // Init has not written gspot.toml yet, so add it to the file list.
    if (!repository.files.some((file) => file.path === SETTINGS_FILE)) {
        const bytes = Buffer.from(text);
        repository.files.push(
            classifyFile(
                reads.root,
                {
                    path: SETTINGS_FILE,
                    executable: false,
                    symlink: false,
                    size: bytes.length,
                },
                bytes,
                { generatedPaths, attributes: repository.attributes },
            ),
        );
    }
    return repository;
}

/**
 * Open a repository session. Refuse invalid settings or configuration choices.
 *
 * @param rootPath the repository root.
 * @param options where the tools sit, and what the run already read.
 * @param options.installedRoot the working repository with the installed tools.
 * @param options.reads the run cache.
 * @param options.settingsFile the settings to use, or none to read them from the repository.
 * @param options.resources the cleanup stack of the caller.
 * @param options.cancelSignal stops the operations of this session.
 * @returns the validated session.
 */
export async function openSession(
    rootPath: string,
    {
        installedRoot = rootPath,
        reads = createReadCache(rootPath),
        settingsFile = readSettings(rootPath),
        resources = new DisposableStack(),
        cancelSignal,
    }: {
        installedRoot?: string;
        reads?: ReadCache;
        settingsFile?: SettingsFile;
        resources?: DisposableStack;
        cancelSignal?: AbortSignal | undefined;
    } = {},
): Promise<Session> {
    const root = reads.root;
    const configurations = readConfigurations();
    const settings = settingsFile.settings;
    const repository = await readSessionRepository({ settings, text: settingsFile.text, configurations, reads });
    let pin: Promise<PackageManagerPin> | undefined;
    const readPackageManager = () =>
        (pin ??= detectPackageManager(
            root,
            repository.files.filter((file) => file.kind === 'source').map((file) => file.path),
        ));
    const scopes = await buildScopes(settings, repository, configurations, readPackageManager);
    const timeoutSeconds = Number(findRootScope(scopes).settings.settings['tool_timeout_seconds']);
    const session: Session = {
        neededToolConfigurations: [],
        configuredChecks: [],
        resources,
        cancelSignal,
        timeoutSeconds,
        packageManager: undefined,
        root,
        installedRoot,
        startRunner: await selectStartRunner(root),
        settingsFile,
        configurations,
        repository,
        scopes,
        inspections: new Map(),
        reads,
    };
    session.configuredChecks = planChecks(session, { stage: 'any', forConfiguration: true }).filter(
        (check) => isActive(check) && check.skip === undefined,
    );
    session.neededToolConfigurations = selectNeededConfigurations(session, session.configuredChecks);
    if (Object.keys(listToolProjectPins(session.neededToolConfigurations).npm).length > 0)
        session.packageManager = await readPackageManager();
    return session;
}

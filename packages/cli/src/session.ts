import { readSettings } from '#cli/settings/read.ts';
import { type Session } from '#cli/types/planning.ts';
import { readRepository } from '#cli/repository/read.ts';
import { getToolTimeoutSeconds } from '#cli/tools/run.ts';
import { planRun, isActive } from '#cli/planning/checks.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { type Repository } from '#cli/types/repository/inventory.ts';
import { selectNeededManifests } from '#cli/planning/needed-tools.ts';
import { listAutomaticConfigurations } from '#cli/configurations/select.ts';
import { buildScopeView, findRootSelection } from '#cli/settings/scope-view.ts';
import { classifyFile, listFileDeclarations } from '#cli/repository/classify.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import { type PackageManagerDeclaration } from '#cli/types/parsers/dependencies.ts';
import { selectRunner, selectPackageManager } from '#cli/repository/package-manager.ts';
import { BUILD_SCRIPT, OPENNEXT_PACKAGE, OPENNEXT_TYPE_DEFAULTS } from '#cli/config/settings/defaults.ts';
import type { Settings, SettingsFile, KnownSettings, ScopeSelection } from '#cli/types/settings/values.ts';

function applyOpenNextDefaults(known: KnownSettings): void {
    for (const [name, value] of Object.entries(OPENNEXT_TYPE_DEFAULTS)) {
        const held = known.defaults.get(name);
        if (held !== undefined) known.defaults.set(name, { ...held, value });
    }
}

// Resolve every scope: its configurations, known settings, and merged view.
async function buildScopeSelections(
    settings: Settings,
    repository: Repository,
    manifests: Map<string, Manifest>,
    readPackageManager: () => Promise<PackageManagerDeclaration>,
): Promise<ScopeSelection[]> {
    const { scopes } = repository;
    const automatic = listAutomaticConfigurations(manifests, repository);
    const effective = { ...settings, configurations: [...new Set([...settings.configurations, ...automatic])] };
    return await Promise.all(
        scopes.map(async (scope) => {
            const selected = selectForScope(effective, scope.path, manifests);
            const known = buildKnownSettings(selected, settings.level);
            const build = known.defaults.get('site.build_command');
            if (build !== undefined) {
                const { name } = await readPackageManager();
                known.defaults.set('site.build_command', {
                    ...build,
                    value: [name, ...BUILD_SCRIPT],
                });
            }
            if (listProjectDependencyNames(repository.dependencyFiles, scope.path).includes(OPENNEXT_PACKAGE))
                applyOpenNextDefaults(known);
            const view = buildScopeView(known, effective, selected, scope.path);
            return { scope, selected, known, view };
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
 * @param input.manifests the shipped configuration declarations.
 * @param input.reads the current repository cache and root folder.
 * @returns the inventory used both before and after fixes.
 */
export async function readSessionRepository({
    settings,
    text,
    manifests,
    reads,
}: {
    settings: Settings;
    text: SettingsFile['text'];
    manifests: Map<string, Manifest>;
    reads: ReadCache;
}): Promise<Repository> {
    const selected = new Map(
        ['', ...Object.keys(settings.scopes)].map((path) => [path, selectForScope(settings, path, manifests)]),
    );
    const declarations = listFileDeclarations(selected);
    const repository = await readRepository(reads, {
        declarations,
        scopes: Object.entries(settings.scopes).map(([path, scope]) => ({
            path,
            configurations: scope.configurations,
        })),
        manifests,
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
                { declarations, attributes: repository.attributes },
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
    const manifests = readManifests();
    const settings = settingsFile.settings;
    const repository = await readSessionRepository({ settings, text: settingsFile.text, manifests, reads });
    let declaration: Promise<PackageManagerDeclaration> | undefined;
    const readPackageManager = () =>
        (declaration ??= selectPackageManager(
            root,
            repository.files.filter((file) => file.kind === 'source').map((file) => file.path),
        ));
    const scopes = await buildScopeSelections(settings, repository, manifests, readPackageManager);
    const timeoutSeconds = getToolTimeoutSeconds(findRootSelection(scopes).view);
    const session: Session = {
        neededToolManifests: [],
        configuredChecks: [],
        resources,
        cancelSignal,
        timeoutSeconds,
        packageManager: undefined,
        root,
        installedRoot,
        startRunner: await selectRunner(root),
        settingsFile,
        manifests,
        repository,
        scopes,
        inspections: new Map(),
        reads,
    };
    session.configuredChecks = planRun(session, { stage: 'any', forConfiguration: true }).filter(
        (check) => isActive(check) && check.skip === undefined,
    );
    session.neededToolManifests = selectNeededManifests(session, session.configuredChecks);
    if (Object.keys(listToolProjectPins(session.neededToolManifests).npm).length > 0)
        session.packageManager = await readPackageManager();
    return session;
}

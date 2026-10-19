import { GspotError } from '#cli/system/errors.ts';
import { readSettings } from '#cli/settings/read.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { type Session } from '#cli/types/planning.ts';
import { selectRunner } from '#cli/generation/hooks.ts';
import { readRepository } from '#cli/repository/read.ts';
import { getToolTimeoutSeconds } from '#cli/tools/run.ts';
import { planRun, isActive } from '#cli/planning/checks.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { readManifests } from '#cli/configurations/manifests.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { type Repository } from '#cli/types/repository/inventory.ts';
import { listSelectedManifests } from '#cli/configurations/select.ts';
import { selectNeededManifests } from '#cli/planning/needed-tools.ts';
import { buildToolFiles } from '#cli/generation/tool-files/generate.ts';
import type { ToolFileGeneration } from '#cli/types/generation/files.ts';
import { locateCandidates, readMiseBinPaths } from '#cli/tools/locate.ts';
import { MISSING_PACKAGE_MANAGER_MESSAGE } from '#cli/config/tools/npm.ts';
import { buildScopeView, findRootSelection } from '#cli/settings/scope-view.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';
import { classifyFile, listFileDeclarations } from '#cli/repository/classify.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import { selectPackageManager, readPackageManagerVersion } from '#cli/repository/package-manager.ts';
import { BUILD_SCRIPT, OPENNEXT_PACKAGE, OPENNEXT_TYPE_DEFAULTS } from '#cli/config/settings/defaults.ts';
import type { Settings, SettingsFile, KnownSettings, ScopeSelection } from '#cli/types/settings/values.ts';
import { type PackageManager, type PackageManagerDeclaration } from '#cli/types/parsers/dependency-files.ts';

function buildSession(values: Omit<Session, 'toolFiles' | 'generatedPaths' | 'uvPath' | 'miseBinPaths'>): Session {
    let toolFiles: ToolFileGeneration | undefined;
    let generatedPaths: ReadonlySet<string> | undefined;
    let miseBinPaths: string[] | undefined;
    let uvPath: string | undefined;
    const { repository, scopes, reads, installedRoot, timeoutSeconds } = values;
    const session: Session = {
        ...values,
        toolFiles: () => (toolFiles ??= buildToolFiles(session)),
        // The tracked files that the repository marks as generated.
        generatedPaths: () =>
            (generatedPaths ??= new Set(
                repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path),
            )),
        get uvPath() {
            uvPath ??= findSessionUvPath(session, installedRoot, timeoutSeconds);
            return uvPath;
        },
        set uvPath(path: string) {
            uvPath = path;
        },
        set miseBinPaths(paths: string[]) {
            miseBinPaths = paths;
            // uv may come from the new mise folders, so the next read looks it up again.
            uvPath = undefined;
        },
        get miseBinPaths() {
            if (miseBinPaths === undefined) {
                miseBinPaths = findSessionMisePaths(scopes, reads, installedRoot, timeoutSeconds);
            }
            return miseBinPaths;
        },
    };
    return session;
}

function buildPackageManagerAccess(installedRoot: string, timeoutSeconds: number) {
    let identity: PackageManagerDeclaration | undefined;
    let state: PackageManager | undefined;
    const access = {
        setIdentity(value: PackageManagerDeclaration) {
            identity = value;
        },
        requirePackageManager: () => {
            const packageManager = access.getPackageManager();
            if (packageManager === undefined) throw new GspotError('installation', MISSING_PACKAGE_MANAGER_MESSAGE);
            return packageManager;
        },
        getPackageManager: () => {
            if (identity === undefined) return undefined;
            state ??= readPackageManagerVersion(installedRoot, identity, timeoutSeconds);
            return state;
        },
        getPackageManagerName: () => identity?.name,
        requirePackageManagerName: () => {
            if (identity === undefined) throw new GspotError('installation', MISSING_PACKAGE_MANAGER_MESSAGE);
            return identity.name;
        },
    };
    return access;
}

function findSessionUvPath(session: Session, installedRoot: string, timeoutSeconds: number): string {
    return (
        locateCandidates(installedRoot, UV_TOOL, {
            search: 'path',
            searchFolders: [],
            miseBinPaths: session.miseBinPaths,
            timeoutSeconds,
        })[0] ?? UV_TOOL
    );
}

function findSessionMisePaths(
    scopes: ScopeSelection[],
    reads: ReadCache,
    installedRoot: string,
    timeoutSeconds: number,
): string[] {
    const tools = listMisePins(listSelectedManifests(scopes), reads).map((pin) => pin.name);
    return readMiseBinPaths(installedRoot, [...new Set(tools)], timeoutSeconds, []);
}

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
    reads: ReadCache,
): Promise<[ScopeSelection[], () => Promise<PackageManagerDeclaration>]> {
    const { files, scopes } = repository;
    const general = new Map([...manifests].filter(([, manifest]) => manifest.configuration.group === 'general'));
    const automatic = detectConfigurations(repository.root, files, general, []).flatMap(({ configuration }) =>
        manifests.get(configuration)?.configuration.when?.git !== true || repository.hasGit ? [configuration] : [],
    );
    const effective = { ...settings, configurations: [...new Set([...settings.configurations, ...automatic])] };
    let identity: Promise<PackageManagerDeclaration> | undefined;
    const getPackageManagerIdentity = () =>
        (identity ??= selectPackageManager(
            repository.root,
            repository.files.filter((file) => file.kind === 'source').map((file) => file.path),
        ));
    const selections = await Promise.all(
        scopes.map(async (scope) => {
            const selected = selectForScope(effective, scope.path, manifests);
            const known = buildKnownSettings(selected, settings.level, reads);
            const build = known.defaults.get('site.build_command');
            if (build !== undefined) {
                const { name } = await getPackageManagerIdentity();
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
    return [selections, getPackageManagerIdentity];
}

// Read the file declarations, and include settings that init has not written yet.
async function readSessionRepository({
    root,
    settings,
    text,
    manifests,
    reads,
}: {
    root: string;
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
                root,
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
 * @param input the settings to use, or none to read them from the repository.
 * @param options where the tools sit, and what the run already read.
 * @param options.installedRoot the working repository with the installed tools.
 * @param options.reads the run cache.
 * @returns the validated session.
 */
export async function openSession(
    rootPath: string,
    input?: SettingsFile,
    { installedRoot = rootPath, reads = createReadCache(rootPath) }: { installedRoot?: string; reads?: ReadCache } = {},
): Promise<Session> {
    const settingsFile = input ?? readSettings(rootPath, reads);
    const root = reads.root;
    const manifests = readManifests(reads);
    const settings = { ...settingsFile.settings };
    const repository = await readSessionRepository({ root, settings, text: settingsFile.text, manifests, reads });
    const [scopes, getPackageManagerIdentity] = await buildScopeSelections(settings, repository, manifests, reads);
    const timeoutSeconds = getToolTimeoutSeconds(findRootSelection(scopes).view);
    const packageManager = buildPackageManagerAccess(installedRoot, timeoutSeconds);
    const session = buildSession({
        neededToolManifests: [],
        configuredChecks: [],
        resources: new DisposableStack(),
        timeoutSeconds,
        requirePackageManager: packageManager.requirePackageManager,
        getPackageManager: packageManager.getPackageManager,
        getPackageManagerName: packageManager.getPackageManagerName,
        requirePackageManagerName: packageManager.requirePackageManagerName,
        root,
        installedRoot,
        startRunner: await selectRunner(root),
        version: packageManifest.version,
        settingsFile: { ...settingsFile, settings },
        manifests,
        repository,
        scopes,
        inspections: new Map(),
        reads,
    });
    session.configuredChecks = planRun(session, { stage: 'any', forConfiguration: true }).filter(
        (check) => isActive(check) && check.skip === undefined,
    );
    session.neededToolManifests = selectNeededManifests(session, session.configuredChecks);
    if (Object.keys(listToolProjectPins(session.neededToolManifests).npm).length > 0)
        packageManager.setIdentity(await getPackageManagerIdentity());
    return session;
}

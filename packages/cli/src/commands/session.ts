import { GspotError } from '#cli/system/errors.ts';
import { readSettings } from '#cli/settings/read.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { type Session } from '#cli/types/planning.ts';
import { startRunner } from '#cli/generation/hooks.ts';
import { classifyFile } from '#cli/repository/kind.ts';
import { toolTimeoutSeconds } from '#cli/tools/run.ts';
import { readRepository } from '#cli/repository/read.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { configuredSystemChecks } from '#cli/planning/checks.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { neededToolManifests } from '#cli/planning/needed-tools.ts';
import { type Repository } from '#cli/types/repository/inventory.ts';
import { locateCandidates, readMiseBinPaths } from '#cli/tools/find.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { MISSING_PACKAGE_MANAGER_MESSAGE } from '#cli/config/tools/npm.ts';
import { misePins, toolProjectPins } from '#cli/configurations/tool-pins.ts';
import { selectForScope, fileDeclarations } from '#cli/repository/select.ts';
import { selectNpmClient, readNpmClientVersion } from '#cli/tools/npm/client.ts';
import type { Settings, SettingsFile, ScopeSelection } from '#cli/types/settings/values.ts';
import { rootView, scopeView, knownSettings, detectedDefaults } from '#cli/settings/view.ts';
import { type NpmClient, type NpmClientIdentity } from '#cli/types/parsers/dependency-files.ts';

// Resolves every scope: its selected configurations, known settings, and merged view.
async function scopeSelections(
    settings: Settings,
    repository: Repository,
    manifests: Map<string, Manifest>,
    reads: ReadCache,
): Promise<[ScopeSelection[], () => Promise<NpmClientIdentity>]> {
    const { files, scopes } = repository;
    const general = new Map([...manifests].filter(([, manifest]) => manifest.configuration.group === 'general'));
    const automatic = detectConfigurations(repository.root, files, general, []).flatMap(({ configuration }) =>
        manifests.get(configuration)?.configuration.when?.git !== true || repository.hasGit ? [configuration] : [],
    );
    const effective = { ...settings, configurations: [...new Set([...settings.configurations, ...automatic])] };
    let identity: Promise<NpmClientIdentity> | undefined;
    const selectInstaller = () =>
        (identity ??= selectNpmClient(
            repository.root,
            repository.files.filter((file) => file.kind === 'source').map((file) => file.path),
        ));
    const selections = await Promise.all(
        scopes.map(async (scope) => {
            const selected = selectForScope(effective, scope.path, manifests);
            const known = knownSettings(selected, settings.level, reads);
            const build = known.defaults.get('site.build_command');
            if (build !== undefined) {
                const { name } = await selectInstaller();
                known.defaults.set('site.build_command', {
                    ...build,
                    value: detectedDefaults({ npmClient: name }).get('site.build_command'),
                });
            }
            const view = scopeView(known, effective, selected, scope.path);
            return { scope, selected, known, view };
        }),
    );
    return [selections, selectInstaller];
}

// Read the selected file declarations and include settings that init has not written yet.
async function readSessionRepository(
    root: string,
    settings: Settings,
    text: SettingsFile['text'],
    manifests: Map<string, Manifest>,
    reads: ReadCache,
): Promise<Repository> {
    const selected = new Map(
        ['', ...Object.keys(settings.scope)].map((path) => [path, selectForScope(settings, path, manifests)]),
    );
    const declarations = fileDeclarations(selected);
    const repository = await readRepository(reads, {
        declarations,
        scopeEntries: Object.entries(settings.scope).map(([path, scope]) => ({
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
 * @param rootPath the repository root
 * @param settingsFile the settings as read, read here by default
 * @param options the repository whose installed tools run against this source tree
 * @param options.installedRoot the working repository with the installed tools
 * @returns the session
 */
export async function openSession(
    rootPath: string,
    settingsFile = readSettings(rootPath),
    { installedRoot = rootPath }: { installedRoot?: string } = {},
): Promise<Session> {
    const reads = createReadCache(rootPath);
    const root = reads.root;
    const manifests = configurationManifests(reads);
    const settings = { ...settingsFile.settings };
    const repository = await readSessionRepository(root, settings, settingsFile.text, manifests, reads);
    const packageManifests = repository.dependencyFiles;
    const [scopes, selectInstaller] = await scopeSelections(settings, repository, manifests, reads);
    const timeoutSeconds = toolTimeoutSeconds(rootView(scopes));
    let npmClientIdentity: NpmClientIdentity | undefined = undefined;
    let installerState: NpmClient | undefined;
    let generatedPaths: ReadonlySet<string> | undefined;
    const toolNames = misePins(scopes.flatMap((selection) => selection.selected)).map((pin) => pin.name);
    const miseBinPaths = readMiseBinPaths(installedRoot, [...new Set(toolNames)], timeoutSeconds, []);
    const session: Session = {
        // Checks use applied targets; content generation here parses unrelated scopes.
        generatedPaths: () =>
            (generatedPaths ??= new Set(
                repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path),
            )),
        uvPath:
            locateCandidates(installedRoot, UV_TOOL, { searchFolders: [], miseBinPaths, timeoutSeconds })[0] ?? UV_TOOL,
        neededToolManifests: [],
        configuredChecks: [],
        resources: new DisposableStack(),
        timeoutSeconds,
        requirePackageManager() {
            const packageManager = session.npmClient();
            if (packageManager === undefined) throw new GspotError('installation', MISSING_PACKAGE_MANAGER_MESSAGE);
            return packageManager;
        },
        npmClient() {
            if (npmClientIdentity === undefined) return undefined;
            installerState ??= readNpmClientVersion(installedRoot, npmClientIdentity, timeoutSeconds);
            return installerState;
        },
        root,
        installedRoot,
        startRunner: await startRunner(root),
        version: packageManifest.version,
        settingsFile: { ...settingsFile, settings },
        manifests,
        repository,
        packageManifests,
        scopes,
        inspections: new Map(),
        reads,
        miseBinPaths,
    };
    session.configuredChecks = configuredSystemChecks(session);
    session.neededToolManifests = neededToolManifests(session, session.configuredChecks);
    npmClientIdentity =
        Object.keys(toolProjectPins(session.neededToolManifests).npm).length > 0 ? await selectInstaller() : undefined;
    return session;
}

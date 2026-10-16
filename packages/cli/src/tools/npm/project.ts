import which from 'which';
import semver from 'semver';
import { join } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import { VERSION_FLAG } from '#cli/config/tools/run.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/find.ts';
import { listExecutableNames } from '#cli/system/paths.ts';
import { writeYarnSettings } from '#cli/tools/npm/yarn.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { readContainedPath } from '#cli/system/files/reads.ts';
import { isYarnBerry } from '#cli/tools/npm/package-manager.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: Lockfile orchestration and its producers share this hoisted result function within the tools module.
import { lockfileResult } from '#cli/tools/project-lockfiles.ts';
import { REINSTALL_HINT } from '#cli/config/tools/diagnostics.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';
import { parseVersionOutput, classifyToolVersion } from '#cli/tools/versions.ts';
import { isLockfileCurrent, stripRegistryUrls } from '#cli/tools/npm/lockfiles.ts';
import { parseToolProject, selectLockfileName } from '#cli/tools/npm/tool-project.ts';
import { rmSync, existsSync, realpathSync, readFileSync, writeFileSync } from 'node:fs';
import { redactInstallOutput, assertCredentialFreeLockfile } from '#cli/tools/credentials.ts';
import { writeNpmrc, readRegistryEnvironment, extractRegistryCredentials } from '#cli/tools/npm/registry.ts';

import {
    DOT_GSPOT,
    YARN_SETTINGS_FILE,
    NPM_TOOL_PROJECT_FILE,
    NODE_MODULES_DIRECTORY,
} from '#cli/config/system/locations.ts';
import {
    type NpmToolProject,
    type PackageCommandResult,
    type PackageManagerCommand,
    type PackageManagerArguments,
} from '#cli/types/tools/project.ts';
import {
    NODE_TOOL,
    NPMRC_FILE,
    YARN_ARGUMENTS,
    INSTALL_ARGUMENTS,
    LOCKFILE_ARGUMENTS,
    NPM_SETTING_PREFIX,
    YARN_INSTALL_SETTINGS_FILE,
    NPM_CONFIG_DIRECTORY_VARIABLE,
} from '#cli/config/tools/npm.ts';

// Resolve in a disposable directory; keep repository credentials out of the portable result.
async function createNpmLockfile(
    context: InstallContext,
    manifest: GeneratedFile,
    project: NpmToolProject,
    recorded: string | undefined,
    yarn: string | undefined,
): Promise<string> {
    const packageManager = context.session.requirePackageManager();
    if (which.sync(NODE_TOOL, { nothrow: true }) === null)
        throw new GspotError(
            'installation',
            'node is required by the npm tool project. Install it before it creates its lockfile.',
        );
    using scratch = createScratchFolder();
    const work = scratch.path;
    writeFileSync(join(work, PACKAGE_JSON), manifest.content);

    if (yarn !== undefined) writeFileSync(join(work, YARN_SETTINGS_FILE), yarn);
    if (recorded !== undefined && isLockfileCurrent(packageManager.name, recorded, project.dependencies))
        writeFileSync(join(work, project.lockfile), recorded);
    const env = await runPackageManager(context, {
        work,
        packageManager,
        arguments: selectPackageManagerArguments(packageManager).lockfile,
        failure: 'lockfile resolution failed',
    });
    stripRegistryUrls(work, packageManager, env);
    const lockfile = readFileSync(join(work, project.lockfile), 'utf8');
    if (!isLockfileCurrent(packageManager.name, lockfile, project.dependencies))
        throw new GspotError(
            'installation',
            `${packageManager.name} produced a mismatched tool lockfile. Existing files were preserved.`,
        );
    return lockfile;
}

// An npm wrapper can declare a package version different from its executable version.
function isVersionCheckNeeded(tool: ToolDeclaration, dependencies: Record<string, string>): boolean {
    const npm = tool.installers['npm'];
    if (tool.kind === 'library' || npm?.version === undefined || tool.version === undefined) return false;
    return npm.version !== tool.version && dependencies[npm.name] === npm.version;
}

async function assertNpmToolVersion(
    context: InstallContext,
    work: string,
    executable: string,
    tool: ToolDeclaration,
): Promise<void> {
    const { steps } = context;
    const { timeoutSeconds } = context.session;
    const command = [executable, ...(tool.version_command ?? [VERSION_FLAG])];
    steps.push(command);
    const result = await runTool(command, {
        cwd: work,
        timeoutSeconds,
        ...(tool.env === undefined ? {} : { env: tool.env }),
    });
    const read = parseVersionOutput(tool, result);
    if (!('version' in read)) throw new GspotError('installation', read.note);
    const want = tool.version ?? read.version;
    const floor = tool.min_version ?? want;
    if (classifyToolVersion(read.version, want, floor) === 'outdated')
        throw new GspotError(
            'installation',
            `${tool.name} reported ${read.version}, below ${floor}. Tool installation is incomplete. Run: gspot install`,
        );
}

// An npm wrapper such as editorconfig-checker downloads its program the first time it runs. Run it here, so
// the download happens during install, and check the version it reports.
async function prepareNpmTools(
    context: InstallContext,
    work: string,
    dependencies: Record<string, string>,
): Promise<void> {
    const root = realpathSync(work);
    // Select the first Windows wrapper that exists: an npm command file or a Bun executable.
    for (const tool of context.tools) {
        if (!isVersionCheckNeeded(tool, dependencies)) continue;
        const name =
            listExecutableNames(tool.name).find((candidate) => existsSync(join(work, NPM_BIN_FOLDER, candidate))) ??
            tool.name;
        await assertNpmToolVersion(context, work, readContainedPath(root, `${NPM_BIN_FOLDER}/${name}`), tool);
    }
}

/**
 * The resolution and immutable-install argv for the selected package manager.
 *
 * @param packageManager the declared package manager and major.
 *
 * @returns both actual package operations.
 */
function selectPackageManagerArguments(packageManager: PackageManager): PackageManagerArguments {
    const yarn = isYarnBerry(packageManager) ? YARN_ARGUMENTS.berry : YARN_ARGUMENTS.classic;
    const args =
        packageManager.name === 'yarn'
            ? yarn
            : { lockfile: LOCKFILE_ARGUMENTS[packageManager.name], install: INSTALL_ARGUMENTS[packageManager.name] };
    return { lockfile: [...args.lockfile], install: [...args.install] };
}

/**
 * Execute a package operation and validate its complete lockfile before publication.
 *
 * @param context the selected tools, repository writer, session, and command log.
 * @param request the package-manager operation and routing.
 *
 * @returns validated lockfile bytes and the private routing environment.
 */
async function runPackageManager(
    context: InstallContext,
    request: PackageManagerCommand,
): Promise<PackageCommandResult> {
    const { root, timeoutSeconds } = context.session;
    const { steps } = context;
    const { work, packageManager, arguments: commandArguments, failure } = request;
    const env = await readRegistryEnvironment(root);
    const credentials = extractRegistryCredentials(env);
    using settings = createScratchFolder();
    try {
        writeNpmrc(settings.path, env);
        env[`${NPM_SETTING_PREFIX}userconfig`] = join(settings.path, NPMRC_FILE);
        env[NPM_CONFIG_DIRECTORY_VARIABLE] = settings.path;
        const berry = isYarnBerry(packageManager);
        if (berry) delete env['YARN_REGISTRY'];
        if (berry) {
            credentials.push(...(await writeYarnSettings(context, work, env)));
            env['YARN_RC_FILENAME'] = YARN_INSTALL_SETTINGS_FILE;
        }
        steps.push(commandArguments);
        const result = await runTool(commandArguments, { cwd: work, env, timeoutSeconds });
        if (result.code !== 0) {
            throw new GspotError(
                'installation',
                `${packageManager.name} ${failure} (exit ${String(result.code)}). ${REINSTALL_HINT}.\n${redactInstallOutput(result, credentials)}`,
            );
        }
        const lockfile = readFileSync(join(work, selectLockfileName(packageManager.name)), 'utf8');
        assertCredentialFreeLockfile(
            lockfile,
            credentials,
            new GspotError(
                'installation',
                'The package manager included registry credentials in its lockfile. Existing files were preserved.',
            ),
        );
        return { env, lockfile };
    } finally {
        rmSync(join(work, YARN_INSTALL_SETTINGS_FILE), { force: true });
    }
}

/**
 * Verify the declared package manager against its executable before writing project inputs.
 * @param packageManager the package manager declaration.
 * @param version the executable's version response.
 * @returns nothing.
 */
function assertPackageManagerVersion(packageManager: PackageManager, version: SpawnResult): void {
    const requirement = `${String(semver.major(packageManager.version))}.x`;
    if (version.code !== 0 || !semver.satisfies(version.stdout.trim(), requirement, { includePrerelease: true }))
        throw new GspotError(
            'tool',
            `The tool project requires ${packageManager.name}@${requirement}. Install that package manager version first.`,
        );
}

/**
 * Prepare the npm tool project's credential-free lockfile.
 *
 * @param context the selected tools, repository writer, session, and command log.
 * @param manifest the generated package.json.
 * @param yarn the generated Yarn settings.
 *
 * @returns the lockfile and its recorded bytes.
 */
async function prepareNpmLockfile(
    context: InstallContext,
    manifest: GeneratedFile,
    yarn: string | undefined,
): Promise<GeneratedFile> {
    const { root } = context.session;
    const owner = context.writer.files;
    const packageManager = context.session.requirePackageManager();
    const project = parseToolProject(manifest.content, packageManager.name);
    const original = owner.read(project.lockfilePath);
    const recorded = original?.bytes.toString('utf8');
    if (
        owner.read(NPM_TOOL_PROJECT_FILE)?.bytes.equals(Buffer.from(manifest.content)) === true &&
        recorded !== undefined &&
        isLockfileCurrent(packageManager.name, recorded, project.dependencies)
    ) {
        assertCredentialFreeLockfile(
            recorded,
            extractRegistryCredentials(await readRegistryEnvironment(root)),
            new GspotError(
                'installation',
                'The npm lockfile includes repository registry credentials. Existing files were preserved. Remove credentials from the registry URL and run: gspot install',
            ),
        );
        return lockfileResult(project.lockfilePath, recorded, original);
    }
    const lockfile = await createNpmLockfile(context, manifest, project, recorded, yarn);
    return lockfileResult(project.lockfilePath, lockfile, original);
}

/**
 * Install the npm tool project in .gspot.
 * @param context the selected tools, repository writer, session, and command log.
 *
 *
 * @returns the installation summary.
 */
async function installNpmTools(context: InstallContext): Promise<string> {
    const { session, steps } = context;
    const { root, timeoutSeconds } = session;
    const owner = context.writer.files;
    const manifest = owner.read(NPM_TOOL_PROJECT_FILE);
    if (manifest === undefined) return '';
    const packageManager = session.requirePackageManager();
    const project = parseToolProject(manifest.bytes.toString('utf8'), session.requirePackageManager().name);
    const lockfile = owner.read(project.lockfilePath)?.bytes.toString('utf8');
    if (lockfile === undefined || !isLockfileCurrent(packageManager.name, lockfile, project.dependencies))
        throw new GspotError('installation', 'Run: gspot install');
    const versionCommand = [packageManager.name, VERSION_FLAG];
    steps.push(versionCommand);
    const version = await runTool(versionCommand, { cwd: root, timeoutSeconds });
    assertPackageManagerVersion(packageManager, version);
    owner.removeTree(NODE_MODULES_DIRECTORY);
    const work = join(root, DOT_GSPOT);
    await runPackageManager(context, {
        work,
        packageManager,
        arguments: selectPackageManagerArguments(packageManager).install,
        failure: 'installation failed',
    });
    await prepareNpmTools(context, work, project.dependencies);
    return `installed locked npm tools under .gspot/node_modules with ${packageManager.name}@${packageManager.version}`;
}

export { installNpmTools, prepareNpmLockfile };

// Prepare and install the npm tool project.
import which from 'which';
import semver from 'semver';
import { join } from 'node:path';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { VERSION_FLAG } from '#cli/config/tools/run.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { writeYarnSettings } from '#cli/install/npm/yarn.ts';
import { rmSync, readFileSync, writeFileSync } from 'node:fs';
import { isYarnBerry } from '#cli/repository/package-manager.ts';
import { REINSTALL_HINT } from '#cli/config/tools/credentials.ts';
import { buildLockfileResult } from '#cli/generation/projects.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { runTool, assertWithinTimeLimit } from '#cli/tools/run.ts';
import { readRootHoldDays } from '#cli/generation/release-holds.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { addToolReleaseHold } from '#cli/install/npm/release-hold.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';
import { isLockfileCurrent, stripRegistryUrls } from '#cli/install/npm/lockfiles.ts';
import { parseToolProject, selectLockfileName } from '#cli/install/npm/tool-project.ts';
import { redactInstallOutput, assertCredentialFreeLockfile } from '#cli/install/credentials.ts';
import { writeNpmrc, readRegistryEnvironment, extractRegistryCredentials } from '#cli/install/npm/registry.ts';

import {
    DOT_GSPOT,
    YARN_SETTINGS_FILE,
    NPM_TOOL_PROJECT_FILE,
    GSPOT_NODE_MODULES_PATH,
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
    NPM_CONFIG_FOLDER_VARIABLE,
} from '#cli/config/tools/npm.ts';

// Resolve in a scratch folder, and keep repository credentials out of the portable result.
async function createNpmLockfile(
    context: InstallContext,
    toolProjectFile: GeneratedFile,
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
    writeFileSync(join(work, PACKAGE_JSON), toolProjectFile.content);

    if (yarn !== undefined) writeFileSync(join(work, YARN_SETTINGS_FILE), yarn);
    if (recorded !== undefined && isLockfileCurrent(packageManager.name, recorded, project.dependencies))
        writeFileSync(join(work, project.lockfile), recorded);
    const lockfileArguments = selectPackageManagerArguments(packageManager).lockfile;
    const days = readRootHoldDays(context.session.scopes);
    // The hold goes where versions get chosen. A frozen install takes them from the lockfile, and npm ci ignores
    // min-release-age-exclude for lockfile entries without a URL.
    const env = await runPackageManager(context, {
        work,
        packageManager,
        arguments: addToolReleaseHold(work, lockfileArguments, packageManager, days),
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

/**
 * Select the lockfile and frozen-install arguments for the package manager.
 *
 * @param packageManager the declared name and major version.
 *
 * @returns the arguments of both operations.
 */
function selectPackageManagerArguments(packageManager: PackageManager): PackageManagerArguments {
    const yarn = isYarnBerry(packageManager) ? YARN_ARGUMENTS.berry : YARN_ARGUMENTS.classic;
    const commandArguments =
        packageManager.name === 'yarn'
            ? yarn
            : { lockfile: LOCKFILE_ARGUMENTS[packageManager.name], install: INSTALL_ARGUMENTS[packageManager.name] };
    return { lockfile: [...commandArguments.lockfile], install: [...commandArguments.install] };
}

/**
 * Run a package manager operation, and validate its full lockfile before it gets written.
 *
 * @param context what install needs for this step.
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
        env[NPM_CONFIG_FOLDER_VARIABLE] = settings.path;
        const berry = isYarnBerry(packageManager);
        if (berry) delete env['YARN_REGISTRY'];
        if (berry) {
            credentials.push(...(await writeYarnSettings(context, work, env)));
            env['YARN_RC_FILENAME'] = YARN_INSTALL_SETTINGS_FILE;
        }
        steps.push(commandArguments);
        const result = await runTool(commandArguments, {
            cancelSignal: context.cancelSignal,
            cwd: work,
            env,
            timeoutSeconds,
        });
        context.cancelSignal?.throwIfAborted();
        assertWithinTimeLimit(packageManager.name, result, timeoutSeconds);
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
 * @param packageManager the declaration to verify.
 * @param version what the executable printed.
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
 * Verify the package manager executable before install changes any tool inputs.
 * @param context what install needs for this step.
 */
async function verifyPackageManagerVersion(context: InstallContext): Promise<void> {
    const { session, steps } = context;
    const packageManager = session.getPackageManager();
    if (packageManager === undefined) return;
    const { root, timeoutSeconds } = session;
    const versionCommand = [packageManager.name, VERSION_FLAG];
    steps.push(versionCommand);
    const version = await runTool(versionCommand, { cancelSignal: context.cancelSignal, cwd: root, timeoutSeconds });
    context.cancelSignal?.throwIfAborted();
    assertPackageManagerVersion(packageManager, version);
}

/**
 * Prepare the npm tool project lockfile, free of credentials.
 *
 * @param context what install needs for this step.
 * @param toolProjectFile the generated package.json.
 * @param yarn the generated Yarn settings text, if any.
 *
 * @returns the lockfile and its recorded bytes.
 */
async function prepareNpmLockfile(
    context: InstallContext,
    toolProjectFile: GeneratedFile,
    yarn: string | undefined,
): Promise<GeneratedFile> {
    const { root } = context.session;
    const owner = context.writer.files;
    const packageManager = context.session.requirePackageManager();
    const project = parseToolProject(toolProjectFile.content, packageManager.name);
    const original = owner.read(project.lockfilePath);
    const recorded = original?.bytes.toString('utf8');
    if (
        owner.read(NPM_TOOL_PROJECT_FILE)?.bytes.equals(Buffer.from(toolProjectFile.content)) === true &&
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
        return buildLockfileResult(project.lockfilePath, recorded, original);
    }
    const lockfile = await createNpmLockfile(context, toolProjectFile, project, recorded, yarn);
    return buildLockfileResult(project.lockfilePath, lockfile, original);
}

/**
 * Install the npm tool project in .gspot.
 * @param context what install needs for this step.
 * @returns the install summary.
 */
async function installNpmTools(context: InstallContext): Promise<string> {
    const { session } = context;
    const { root } = session;
    const owner = context.writer.files;
    const toolProjectFile = owner.read(NPM_TOOL_PROJECT_FILE);
    if (toolProjectFile === undefined) return '';
    const packageManager = session.requirePackageManager();
    const project = parseToolProject(toolProjectFile.bytes.toString('utf8'), session.requirePackageManagerName());
    const lockfile = owner.read(project.lockfilePath)?.bytes.toString('utf8');
    if (lockfile === undefined || !isLockfileCurrent(packageManager.name, lockfile, project.dependencies))
        throw new GspotError('installation', 'Run: gspot install');
    owner.deleteTree(GSPOT_NODE_MODULES_PATH);
    const work = join(root, DOT_GSPOT);
    await runPackageManager(context, {
        work,
        packageManager,
        arguments: selectPackageManagerArguments(packageManager).install,
        failure: 'installation failed',
    });
    return `installed ${formatCount(Object.keys(project.dependencies).length, 'npm tool')} in .gspot/node_modules (${packageManager.name} ${packageManager.version})`;
}

export { installNpmTools, prepareNpmLockfile, verifyPackageManagerVersion };

// Prepare and install the npm tool project.
import which from 'which';
import semver from 'semver';
import { join } from 'node:path';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { runInstallStep } from '#cli/install/steps.ts';
import { VERSION_FLAG } from '#cli/config/tools/run.ts';
import { writeYarnSettings } from '#cli/install/npm/yarn.ts';
import { rmSync, readFileSync, writeFileSync } from 'node:fs';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';
import { REINSTALL_HELP } from '#cli/config/install/credentials.ts';
import { prepareReleaseAge } from '#cli/install/npm/release-age.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { parseToolPackageJson } from '#cli/install/npm/tool-project.ts';
import { getTable, findRootScope } from '#cli/settings/scope-settings.ts';
import { type NpmToolProject } from '#cli/types/install/tool-projects.ts';
import type { PackageManager } from '#cli/types/repository/package-manager.ts';
import { isLockfileCurrent, stripRegistryUrls } from '#cli/install/npm/lockfiles.ts';
import { redactInstallOutput, assertCredentialFreeLockfile } from '#cli/install/credentials.ts';
import { writeNpmrc, readRegistryEnvironment, extractRegistryCredentials } from '#cli/install/npm/registry.ts';
import { isYarnBerry, assertPackageManager, readPackageManagerVersion } from '#cli/repository/npm/package-manager.ts';

import {
    type PackageManagerRun,
    type PackageManagerCommand,
    type PackageManagerArguments,
} from '#cli/types/install/npm.ts';
import {
    DOT_GSPOT,
    YARN_SETTINGS_FILE,
    NPM_TOOL_PROJECT_FILE,
    GSPOT_NODE_MODULES_PATH,
} from '#cli/config/gspot-paths.ts';
import {
    NODE_TOOL,
    NPMRC_FILE,
    YARN_ARGUMENTS,
    INSTALL_ARGUMENTS,
    LOCKFILE_ARGUMENTS,
    NPM_SETTING_PREFIX,
    YARN_REGISTRY_VARIABLE,
    YARN_INSTALL_SETTINGS_FILE,
    NPM_CONFIG_FOLDER_VARIABLE,
    YARN_SETTINGS_FILE_VARIABLE,
} from '#cli/config/install/npm.ts';

// Resolve in a temporary folder, and keep repository credentials out of the portable result.
async function createNpmLockfile(
    install: ToolInstall,
    toolProjectFile: GeneratedFile,
    project: NpmToolProject,
    recorded: string | undefined,
    yarn: string | undefined,
): Promise<string> {
    const packageManager = readPackageManagerVersion(
        install.session.installedRoot,
        assertPackageManager(install.session.packageManager),
        install.session.timeoutSeconds,
        install.session.reads,
    );
    if (which.sync(NODE_TOOL, { nothrow: true }) === null)
        throw new GspotError(
            'install',
            'node is required by the npm tool project. Install it before it creates its lockfile.',
        );
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PACKAGE_JSON), toolProjectFile.content);

    if (yarn !== undefined) writeFileSync(join(runFolder, YARN_SETTINGS_FILE), yarn);
    if (recorded !== undefined && isLockfileCurrent(packageManager.name, recorded, project.dependencies))
        writeFileSync(join(runFolder, project.lockfile), recorded);
    const lockfileArguments = selectPackageManagerArguments(packageManager).lockfile;
    const days = getTable(findRootScope(install.session.scopes).settings, 'dependencies').min_release_age_days;
    // The hold goes where versions get chosen. A frozen install takes them from the lockfile, and npm ci ignores
    // min-release-age-exclude for lockfile entries without a URL.
    const run = await runPackageManager(install, {
        runFolder,
        packageManager,
        commandArguments: prepareReleaseAge(runFolder, lockfileArguments, packageManager, days),
        failure: 'lockfile resolution failed',
    });
    const lockfilePath = join(runFolder, project.lockfile);
    assertCredentialFreeLockfile(
        readFileSync(lockfilePath, 'utf8'),
        run.credentials,
        'The package manager included registry credentials in its lockfile. Existing files were preserved.',
    );
    stripRegistryUrls(lockfilePath, packageManager, run.env);
    const lockfile = readFileSync(join(runFolder, project.lockfile), 'utf8');
    if (!isLockfileCurrent(packageManager.name, lockfile, project.dependencies))
        throw new GspotError(
            'install',
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
 * Run a package manager operation with private registry routing.
 *
 * @param install what install needs for this step.
 * @param request the package-manager operation and routing.
 *
 * @returns the private routing environment and credentials to keep out of lockfiles.
 */
async function runPackageManager(install: ToolInstall, request: PackageManagerCommand): Promise<PackageManagerRun> {
    const { root } = install.session;
    const { runFolder, packageManager, commandArguments, failure } = request;
    const env = await readRegistryEnvironment(root);
    const credentials = extractRegistryCredentials(env);
    using settings = createTemporaryFolder();
    try {
        writeNpmrc(settings.path, env);
        env[`${NPM_SETTING_PREFIX}userconfig`] = join(settings.path, NPMRC_FILE);
        env[NPM_CONFIG_FOLDER_VARIABLE] = settings.path;
        const berry = isYarnBerry(packageManager);
        if (berry) {
            Reflect.deleteProperty(env, YARN_REGISTRY_VARIABLE);
            credentials.push(...(await writeYarnSettings(install, runFolder, env)));
            env[YARN_SETTINGS_FILE_VARIABLE] = YARN_INSTALL_SETTINGS_FILE;
        }
        const result = await runInstallStep(install, commandArguments, { cwd: runFolder, env });
        if (result.code !== 0) {
            throw new GspotError(
                'install',
                `${packageManager.name} ${failure} (exit ${String(result.code)}). ${REINSTALL_HELP}.\n${redactInstallOutput(result, credentials)}`,
            );
        }
        return { env, credentials };
    } finally {
        rmSync(join(runFolder, YARN_INSTALL_SETTINGS_FILE), { force: true });
    }
}

/**
 * Verify the package manager executable before install changes any tool inputs.
 *
 * @param install what install needs for this step.
 */
export async function assertPackageManagerVersion(install: ToolInstall): Promise<void> {
    const { session } = install;
    const packageManager =
        session.packageManager === undefined
            ? undefined
            : readPackageManagerVersion(
                  session.installedRoot,
                  assertPackageManager(session.packageManager),
                  session.timeoutSeconds,
                  session.reads,
              );
    if (packageManager === undefined) return;
    const { root } = session;
    const versionCommand = [packageManager.name, VERSION_FLAG];
    const version = await runInstallStep(install, versionCommand, { cwd: root });
    const requirement = `${String(semver.major(packageManager.version))}.x`;
    const found = version.stdout.trim();
    if (version.code === 0 && semver.satisfies(found, requirement, { includePrerelease: true })) return;
    const result =
        version.code === 0
            ? `found ${found}`
            : `\`${packageManager.name} ${VERSION_FLAG}\` exited with ${String(version.code)}: ${version.stderr.trim()}`;
    throw new GspotError(
        'tool',
        `The tool project requires ${packageManager.name}@${requirement}, and ${result}. Install that package manager version first.`,
    );
}

/**
 * Prepare the npm tool project lockfile, free of credentials.
 *
 * @param install what install needs for this step.
 * @param toolProjectFile the generated package.json.
 * @param yarn the generated Yarn settings text, if any.
 *
 * @returns the lockfile and its recorded bytes.
 */
export async function prepareNpmLockfile(
    install: ToolInstall,
    toolProjectFile: GeneratedFile,
    yarn: string | undefined,
): Promise<GeneratedFile> {
    const { root } = install.session;
    const owner = install.writer.files;
    const packageManager = readPackageManagerVersion(
        install.session.installedRoot,
        assertPackageManager(install.session.packageManager),
        install.session.timeoutSeconds,
        install.session.reads,
    );
    const project = parseToolPackageJson(toolProjectFile.content, packageManager.name);
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
            'The npm lockfile includes repository registry credentials. Existing files were preserved. Remove credentials from the registry URL and run: gspot install',
        );
        return { path: project.lockfilePath, content: recorded, kind: 'lock', read: original };
    }
    const lockfile = await createNpmLockfile(install, toolProjectFile, project, recorded, yarn);
    return { path: project.lockfilePath, content: lockfile, kind: 'lock', read: original };
}

/**
 * Install the npm tool project in .gspot.
 *
 * @param install what install needs for this step.
 * @returns the install summary.
 */
export async function installNpmTools(install: ToolInstall): Promise<string> {
    const { session } = install;
    const { root } = session;
    const owner = install.writer.files;
    const toolProjectFile = owner.read(NPM_TOOL_PROJECT_FILE);
    if (toolProjectFile === undefined) return '';
    const packageManager = readPackageManagerVersion(
        session.installedRoot,
        assertPackageManager(session.packageManager),
        session.timeoutSeconds,
        session.reads,
    );
    const project = parseToolPackageJson(toolProjectFile.bytes.toString('utf8'), packageManager.name);
    owner.deleteTree(GSPOT_NODE_MODULES_PATH);
    const runFolder = join(root, DOT_GSPOT);
    await runPackageManager(install, {
        runFolder,
        packageManager,
        commandArguments: selectPackageManagerArguments(packageManager).install,
        failure: 'installation failed',
    });
    return `installed ${formatCount(Object.keys(project.dependencies).length, 'npm tool')} in ${GSPOT_NODE_MODULES_PATH} (${packageManager.name} ${packageManager.version})`;
}

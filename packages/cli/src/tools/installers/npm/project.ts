import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { CI_NODE, NODE_TOOL } from '#cli/config/repository/version-pin.ts';
import { GSPOT_FOLDER, OWNER_WRITABLE_FILE } from '#cli/config/system.ts';
import {
    DELETED_LOCKFILE_MESSAGE,
    INSTALL_FAILURE,
    LOCK_ONLY_FLAG,
    LOCKFILE_CREDENTIAL_MESSAGE,
    LOCKFILE_FAILURE,
    NODE_MISSING_MESSAGE,
    NPM_CONFIG_FOLDER_VARIABLE,
    NPM_LOCKFILE_CREDENTIAL_MESSAGE,
    NPM_SETTING_PREFIX,
    NPM_TOOL_NOUN,
    NPM_USER_CONFIG_VARIABLE,
    NPMRC_FILE,
    PACKAGE_MANAGER_ARGUMENTS,
    PACKAGE_MANAGER_SETTINGS_NAME,
} from '#cli/config/tools/installers.ts';
import { buildPackageManagerCommand } from '#cli/repository/projects/package-manager.ts';
import { GspotError } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { findProgram } from '#cli/system/processes/programs.ts';
import { formatCount } from '#cli/system/text/messages.ts';
import { assertCredentialFreeLockfile, redactInstallOutput } from '#cli/tools/installers/credentials.ts';
import { explainReleaseAgeHold, listNpmReleases } from '#cli/tools/installers/network/releases.ts';
import { isLockfileFresh, selectLockfileName, stripBunRegistryUrls } from '#cli/tools/installers/npm/lockfiles.ts';
import { extractRegistryCredentials, writeNpmrc } from '#cli/tools/installers/npm/registry.ts';
import { prepareReleaseAge, writeBunReleaseAge } from '#cli/tools/installers/npm/release-age.ts';
import { formatExit, runInstallStep } from '#cli/tools/installers/steps.ts';
import { listNpmProjectPins, listPackagePins } from '#cli/tools/pins.ts';
import type { ReplacementRequest } from '#cli/types/repository.ts';
import type {
    GeneratedFile,
    NpmToolInstall,
    PackageManagerRequest,
    PackageManagerRun,
    ToolInstall,
} from '#cli/types/tools.ts';

async function createNpmLockfile(
    install: NpmToolInstall,
    { toolProjectFile, lockfileName }: { toolProjectFile: GeneratedFile; lockfileName: string },
): Promise<string> {
    if (findProgram(NODE_TOOL) === undefined) throw new GspotError('install', NODE_MISSING_MESSAGE);
    const packageManager = install.packageManager;
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PACKAGE_JSON), toolProjectFile.content);
    const lockfileArguments = PACKAGE_MANAGER_ARGUMENTS[packageManager.name].lockfile;
    const run = await runPackageManager(install, {
        runFolder,
        commandArguments: prepareReleaseAge(lockfileArguments, packageManager, install.releaseAgeDays),
        failure: LOCKFILE_FAILURE,
    });
    const content = readFileSync(join(runFolder, lockfileName), 'utf8');
    assertCredentialFreeLockfile(content, run.credentials, LOCKFILE_CREDENTIAL_MESSAGE);
    return packageManager.name === 'bun' ? stripBunRegistryUrls(content, run.environment) : content;
}

async function runPackageManager(install: NpmToolInstall, request: PackageManagerRequest): Promise<PackageManagerRun> {
    const { runFolder, commandArguments, failure } = request;
    const { packageManager } = install;
    const env = { ...install.registryEnvironment };
    const credentials = extractRegistryCredentials(env);
    using settings = createTemporaryFolder();
    writeNpmrc(settings.path, env);
    env[`${NPM_SETTING_PREFIX}userconfig`] = join(settings.path, NPMRC_FILE);
    env[NPM_USER_CONFIG_VARIABLE] = join(settings.path, NPMRC_FILE);
    env[NPM_CONFIG_FOLDER_VARIABLE] = settings.path;
    const args =
        packageManager.name === 'bun'
            ? [...commandArguments, `--config=${writeBunReleaseAge(settings.path, install.releaseAgeDays)}`]
            : commandArguments;
    const command = buildPackageManagerCommand(packageManager.command, args, CI_NODE);
    const result = await runInstallStep(install, command, {
        cwd: runFolder,
        env,
        step: `installing npm tools with ${packageManager.name} in ${GSPOT_PATHS.nodeModules}`,
    });
    if (result.code !== 0) {
        const output = redactInstallOutput(result, credentials);
        const releases = listNpmReleases(listPackagePins(install.session.toolConfigurations).npm, env);
        const explanation = await explainReleaseAgeHold(install, output, releases);
        throw new GspotError(
            'install',
            `${explanation}${packageManager.name} ${failure} (${formatExit(result)}).\n${output}`,
        );
    }
    return { environment: env, credentials };
}

function formatInstalledTools({ session, packageManager }: NpmToolInstall): string {
    const count = Object.keys(listPackagePins(session.toolConfigurations).npm).length;
    return `installed ${formatCount(count, NPM_TOOL_NOUN)} in ${GSPOT_PATHS.nodeModules} (${packageManager.name} ${packageManager.version})`;
}

function assertSettingsFree(install: ToolInstall): void {
    const paths = install.writer
        .list(GSPOT_FOLDER)
        .filter((name) => PACKAGE_MANAGER_SETTINGS_NAME.test(name))
        .map((name) => `${GSPOT_FOLDER}/${name}`);
    if (paths.length > 0)
        throw new GspotError(
            'install',
            `gspot runs the package manager in ${GSPOT_FOLDER} only when no package manager settings file sits there. Delete ${paths.join(', ')}, then run gspot install.`,
        );
}

export async function planNpmLockfile(
    install: NpmToolInstall,
    toolProjectFile: GeneratedFile,
): Promise<ReplacementRequest> {
    const lockfile = selectLockfileName(install.packageManager.name);
    const path = `${GSPOT_FOLDER}/${lockfile}`;
    const previous = install.writer.read(path);
    if (previous !== undefined && isNpmLockfileFresh(install))
        return { path, next: { bytes: previous.bytes, mode: OWNER_WRITABLE_FILE }, previous };
    const content = await createNpmLockfile(install, { toolProjectFile, lockfileName: lockfile });
    return { path, next: { bytes: Buffer.from(content), mode: OWNER_WRITABLE_FILE }, previous };
}

export function isNpmLockfileFresh(install: NpmToolInstall): boolean {
    const { packageManager, registryEnvironment } = install;
    const saved = install.writer.read(`${GSPOT_FOLDER}/${selectLockfileName(packageManager.name)}`);
    if (saved === undefined) return false;
    const text = saved.bytes.toString('utf8');
    const credentials = extractRegistryCredentials(registryEnvironment);
    assertCredentialFreeLockfile(text, credentials, NPM_LOCKFILE_CREDENTIAL_MESSAGE);
    const dependencies = listNpmProjectPins(install.session);
    return isLockfileFresh(packageManager.name, text, dependencies, registryEnvironment);
}

/**
Resolve and install the npm tool project in one npm run in .gspot, when its lockfile is missing or stale. The run
starts with no lockfile and no node_modules folder, so npm resolves the tree as a lock run in an empty folder does, and
writes the lockfile that later installs read. A lockfile that holds credentials is deleted, and the error stays.
*/
export async function installUnlockedNpmTools(install: NpmToolInstall): Promise<string> {
    if (findProgram(NODE_TOOL) === undefined) throw new GspotError('install', NODE_MISSING_MESSAGE);
    const { root } = install.session;
    const { packageManager, writer } = install;
    const path = `${GSPOT_FOLDER}/${selectLockfileName(packageManager.name)}`;
    assertSettingsFree(install);
    writer.deleteTree(GSPOT_PATHS.nodeModules);
    if (writer.findStats(path) !== undefined) writer.deleteFile(path);
    const lockArguments = PACKAGE_MANAGER_ARGUMENTS.npm.lockfile.filter((argument) => argument !== LOCK_ONLY_FLAG);
    const run = await runPackageManager(install, {
        runFolder: join(root, GSPOT_FOLDER),
        commandArguments: prepareReleaseAge(lockArguments, packageManager, install.releaseAgeDays),
        failure: INSTALL_FAILURE,
    });
    try {
        assertCredentialFreeLockfile(readFileSync(join(root, path), 'utf8'), run.credentials, DELETED_LOCKFILE_MESSAGE);
    } catch (error) {
        writer.deleteFile(path);
        throw error;
    }
    return formatInstalledTools(install);
}

export async function installNpmTools(install: NpmToolInstall): Promise<string> {
    const { root } = install.session;
    const packageManager = install.packageManager;
    assertSettingsFree(install);
    const installArguments = PACKAGE_MANAGER_ARGUMENTS[packageManager.name].install;
    await runPackageManager(install, {
        runFolder: join(root, GSPOT_FOLDER),
        // pnpm holds new releases back by default, so its install needs the hold and the exclusions of the lock step.
        commandArguments:
            packageManager.name === 'pnpm'
                ? prepareReleaseAge(installArguments, packageManager, install.releaseAgeDays)
                : [...installArguments],
        failure: INSTALL_FAILURE,
    });
    return formatInstalledTools(install);
}

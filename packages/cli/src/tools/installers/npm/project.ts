import which from 'which';
import semver from 'semver';
import { join } from 'node:path';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { listPackagePins } from '#cli/tools/pins.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { ReplacementRequest } from '#cli/types/repository.ts';
import { PACKAGE_JSON, GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { VERSION_FLAG } from '#cli/config/repository/javascript.ts';
import { TRAILING_PERIOD } from '#cli/config/settings/validation.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { runInstallStep, explainReleaseAgeHold } from '#cli/tools/installers/steps.ts';
import { buildPackageManagerCommand } from '#cli/repository/javascript/package-manager.ts';
import { writeNpmrc, extractRegistryCredentials } from '#cli/tools/installers/npm/registry.ts';
import { prepareReleaseAge, writeBunReleaseAge } from '#cli/tools/installers/npm/release-age.ts';
import { redactInstallOutput, assertCredentialFreeLockfile } from '#cli/tools/installers/credentials.ts';
import { isLockfileFresh, selectLockfileName, stripBunRegistryUrls } from '#cli/tools/installers/npm/lockfiles.ts';

import type {
    ToolInstall,
    GeneratedFile,
    NpmToolInstall,
    PackageManagerRun,
    PackageManagerRequest,
} from '#cli/types/tools.ts';
import {
    NODE_TOOL,
    NPMRC_FILE,
    NPM_TOOL_NOUN,
    INSTALL_FAILURE,
    LOCKFILE_FAILURE,
    NPM_SETTING_PREFIX,
    RELEASE_AGE_VERSIONS,
    NODE_MISSING_MESSAGE,
    PACKAGE_MANAGER_ARGUMENTS,
    NPM_CONFIG_FOLDER_VARIABLE,
    LOCKFILE_CREDENTIAL_MESSAGE,
    PACKAGE_MANAGER_SETTINGS_NAME,
    NPM_LOCKFILE_CREDENTIAL_MESSAGE,
} from '#cli/config/tools/installers.ts';

async function createNpmLockfile(
    install: NpmToolInstall,
    { toolProjectFile, lockfileName }: { toolProjectFile: GeneratedFile; lockfileName: string },
): Promise<string> {
    const packageManager = install.packageManager;
    if (which.sync(NODE_TOOL, { nothrow: true }) === null) throw new GspotError('install', NODE_MISSING_MESSAGE);
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PACKAGE_JSON), toolProjectFile.content);
    const lockfileArguments = PACKAGE_MANAGER_ARGUMENTS[packageManager.name].lockfile;
    const run = await runPackageManager(install, {
        runFolder,
        packageManager,
        commandArguments: prepareReleaseAge(runFolder, lockfileArguments, packageManager, install.releaseAgeDays),
        failure: LOCKFILE_FAILURE,
        environment: install.registryEnvironment,
    });
    const content = readFileSync(join(runFolder, lockfileName), 'utf8');
    assertCredentialFreeLockfile(content, run.credentials, LOCKFILE_CREDENTIAL_MESSAGE);
    return packageManager.name === 'bun' ? stripBunRegistryUrls(content, run.environment) : content;
}

async function runPackageManager(install: ToolInstall, request: PackageManagerRequest): Promise<PackageManagerRun> {
    const { runFolder, packageManager, commandArguments, failure } = request;
    const env = { ...request.environment };
    const credentials = extractRegistryCredentials(env);
    using settings = createTemporaryFolder();
    writeNpmrc(settings.path, env);
    env[`${NPM_SETTING_PREFIX}userconfig`] = join(settings.path, NPMRC_FILE);
    env[NPM_CONFIG_FOLDER_VARIABLE] = settings.path;
    const args =
        packageManager.name === 'bun'
            ? [...commandArguments, `--config=${writeBunReleaseAge(settings.path, install.releaseAgeDays)}`]
            : commandArguments;
    const command = buildPackageManagerCommand(packageManager.command, args);
    const result = await runInstallStep(install, command, {
        cwd: runFolder,
        env,
        step: `installing npm tools with ${packageManager.name} in ${GSPOT_PATHS.nodeModules}`,
    });
    if (result.code !== 0) {
        const output = redactInstallOutput(result, credentials);
        const pins = Object.entries(listPackagePins(install.session.toolConfigurations).npm).map(
            ([name, version]) => `${name}@${version}`,
        );
        throw new GspotError(
            'install',
            `${explainReleaseAgeHold(install, output, pins)}${packageManager.name} ${failure} (exit ${String(result.code)}).\n${output}`,
        );
    }
    return { environment: env, credentials };
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

/**
Verify the package manager executable before install changes any tool project file.

@param install the tool install of this step.
*/
export async function assertPackageManagerVersion(install: ToolInstall): Promise<void> {
    const { session, packageManager } = install;
    if (packageManager === undefined) return;
    const versionCommand = buildPackageManagerCommand(packageManager.command, [VERSION_FLAG]);
    const version = await runInstallStep(install, versionCommand, { cwd: session.root });
    const requirement = `${String(semver.major(packageManager.version))}.x`;
    const found = version.stdout.trim();
    if (version.code === 0 && semver.satisfies(found, requirement, { includePrerelease: true })) {
        const minimum = RELEASE_AGE_VERSIONS[packageManager.name];
        if (semver.lt(found, minimum))
            throw new GspotError(
                'install',
                `gspot install needs ${packageManager.name} ${minimum} or later, which holds back new releases for dependencies.min_release_age_days. Found ${found}.`,
            );
        return;
    }
    const result =
        version.code === 0
            ? `found ${found}`
            : `\`${packageManager.name} ${VERSION_FLAG}\` exited with ${String(version.code)}: ${version.stderr.trim().replace(TRAILING_PERIOD, '')}`;
    throw new GspotError(
        'tool',
        `The tool project requires ${packageManager.name}@${requirement}, and ${result}. Install that package manager version first.`,
    );
}

/**
Prepare the npm tool project lockfile, free of credentials.

@param install what install needs for this step.
@param toolProjectFile the generated package.json.
*/
export async function planNpmLockfile(
    install: NpmToolInstall,
    toolProjectFile: GeneratedFile,
): Promise<ReplacementRequest> {
    const { packageManager, registryEnvironment } = install;
    const lockfile = selectLockfileName(packageManager.name);
    const path = `${GSPOT_FOLDER}/${lockfile}`;
    const previous = install.writer.read(path);
    const saved = previous?.bytes.toString('utf8');
    if (saved !== undefined) {
        assertCredentialFreeLockfile(
            saved,
            extractRegistryCredentials(registryEnvironment),
            NPM_LOCKFILE_CREDENTIAL_MESSAGE,
        );
        const dependencies = listPackagePins(install.session.toolConfigurations).npm;
        if (isLockfileFresh(packageManager.name, saved, dependencies, registryEnvironment))
            return { path, next: { bytes: Buffer.from(saved), mode: OWNER_WRITABLE_FILE }, previous: previous };
    }
    const content = await createNpmLockfile(install, { toolProjectFile, lockfileName: lockfile });
    return { path, next: { bytes: Buffer.from(content), mode: OWNER_WRITABLE_FILE }, previous: previous };
}

/**
Install the npm tool project in .gspot.

@param install what install needs for this step.
*/
export async function installNpmTools(install: NpmToolInstall): Promise<string> {
    const { root, toolConfigurations } = install.session;
    const packageManager = install.packageManager;
    assertSettingsFree(install);
    await runPackageManager(install, {
        runFolder: join(root, GSPOT_FOLDER),
        packageManager,
        commandArguments: [...PACKAGE_MANAGER_ARGUMENTS[packageManager.name].install],
        failure: INSTALL_FAILURE,
        environment: install.registryEnvironment,
    });
    const count = Object.keys(listPackagePins(toolConfigurations).npm).length;
    return `installed ${formatCount(count, NPM_TOOL_NOUN)} in ${GSPOT_PATHS.nodeModules} (${packageManager.name} ${packageManager.version})`;
}

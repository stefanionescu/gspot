import which from 'which';
import semver from 'semver';
import { join } from 'node:path';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { runInstallStep } from '#cli/installers/steps.ts';
import { VERSION_FLAG } from '#cli/config/tools/versions.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { ToolInstall } from '#cli/types/installers/install.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { buildInstallKey, recordInstalledProject } from '#cli/installers/record.ts';
import { buildPackageManagerCommand } from '#cli/repository/npm/package-manager.ts';
import { writeNpmrc, extractRegistryCredentials } from '#cli/installers/npm/registry.ts';
import { prepareReleaseAge, writeBunReleaseAge } from '#cli/installers/npm/release-age.ts';
import { redactInstallOutput, assertCredentialFreeLockfile } from '#cli/installers/credentials.ts';
import { isLockfileFresh, selectLockfileName, stripBunRegistryUrls } from '#cli/installers/npm/lockfiles.ts';
import { type NpmToolInstall, type PackageManagerRun, type PackageManagerRequest } from '#cli/types/installers/npm.ts';

import {
    NODE_TOOL,
    NPMRC_FILE,
    NPM_SETTING_PREFIX,
    RELEASE_AGE_VERSIONS,
    PACKAGE_MANAGER_ARGUMENTS,
    NPM_CONFIG_FOLDER_VARIABLE,
} from '#cli/config/installers/npm/project.ts';

async function createNpmLockfile(
    install: NpmToolInstall,
    { toolProjectFile, lockfile }: { toolProjectFile: GeneratedFile; lockfile: string },
): Promise<string> {
    const packageManager = install.packageManager;
    if (which.sync(NODE_TOOL, { nothrow: true }) === null)
        throw new GspotError('install', 'The npm tool project needs Node.js to create its lockfile. Install Node.js.');
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PACKAGE_JSON), toolProjectFile.content);
    const lockfileArguments = PACKAGE_MANAGER_ARGUMENTS[packageManager.name].lockfile;
    const run = await runPackageManager(install, {
        runFolder,
        packageManager,
        commandArguments: prepareReleaseAge(runFolder, lockfileArguments, packageManager, install.minimumReleaseAge),
        failure: 'lockfile resolution failed',
        env: install.registryEnvironment,
    });
    const content = readFileSync(join(runFolder, lockfile), 'utf8');
    assertCredentialFreeLockfile(
        content,
        run.credentials,
        'The package manager wrote registry credentials into its lockfile. gspot kept the existing files.',
    );
    return packageManager.name === 'bun' ? stripBunRegistryUrls(content, run.env) : content;
}

async function runPackageManager(install: ToolInstall, request: PackageManagerRequest): Promise<PackageManagerRun> {
    const { runFolder, packageManager, commandArguments, failure } = request;
    const env = { ...request.env };
    const credentials = extractRegistryCredentials(env);
    using settings = createTemporaryFolder();
    writeNpmrc(settings.path, env);
    env[`${NPM_SETTING_PREFIX}userconfig`] = join(settings.path, NPMRC_FILE);
    env[NPM_CONFIG_FOLDER_VARIABLE] = settings.path;
    const args =
        packageManager.name === 'bun'
            ? [...commandArguments, `--config=${writeBunReleaseAge(settings.path, install.minimumReleaseAge)}`]
            : commandArguments;
    const command = buildPackageManagerCommand(packageManager.command, args);
    const result = await runInstallStep(install, command, { cwd: runFolder, env });
    if (result.code !== 0) {
        throw new GspotError(
            'install',
            `${packageManager.name} ${failure} (exit ${String(result.code)}).\n${redactInstallOutput(result, credentials)}`,
        );
    }
    return { env, credentials };
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
            : `\`${packageManager.name} ${VERSION_FLAG}\` exited with ${String(version.code)}: ${version.stderr.trim()}`;
    throw new GspotError(
        'tool',
        `The tool project requires ${packageManager.name}@${requirement}, and ${result}. Install that package manager version first.`,
    );
}

/**
Prepare the npm tool project lockfile, free of credentials.

@param install what install needs for this step.
@param toolProjectFile the generated package.json.

@returns the lockfile and its recorded bytes.
*/
export async function prepareNpmLockfile(
    install: NpmToolInstall,
    toolProjectFile: GeneratedFile,
): Promise<GeneratedFile> {
    const { packageManager, registryEnvironment } = install;
    const lockfile = selectLockfileName(packageManager.name);
    const path = `${GSPOT_FOLDER}/${lockfile}`;
    const previous = install.writer.read(path);
    const saved = previous?.bytes.toString('utf8');
    if (saved !== undefined) {
        assertCredentialFreeLockfile(
            saved,
            extractRegistryCredentials(registryEnvironment),
            'The npm lockfile holds the registry credentials of the repository. gspot kept the existing files. Remove the credentials from the registry URL.',
        );
        const dependencies = listToolProjectPins(install.session.toolConfigurations).npm;
        if (isLockfileFresh(packageManager.name, saved, dependencies, registryEnvironment))
            return { path, content: saved, kind: 'lock', read: previous };
    }
    const content = await createNpmLockfile(install, { toolProjectFile, lockfile });
    return { path, content, kind: 'lock', read: previous };
}

/**
Install the npm tool project in .gspot.

@param install what install needs for this step.
@returns the install summary.
*/
export async function installNpmTools(install: NpmToolInstall): Promise<string> {
    const { root, toolConfigurations } = install.session;
    const packageManager = install.packageManager;
    const key =
        packageManager.name === 'npm'
            ? buildInstallKey([
                  `${packageManager.name}@${packageManager.version}`,
                  (install.writer.read(`${GSPOT_FOLDER}/package-lock.json`) as FileContents).bytes,
              ])
            : undefined;
    if (
        key !== undefined &&
        install.record.npm === key &&
        install.writer.readStats(GSPOT_PATHS.nodeModules)?.isDirectory() === true
    )
        return '';
    await runPackageManager(install, {
        runFolder: join(root, GSPOT_FOLDER),
        packageManager,
        commandArguments: [...PACKAGE_MANAGER_ARGUMENTS[packageManager.name].install],
        failure: 'installation failed',
        env: install.registryEnvironment,
    });
    if (key !== undefined) recordInstalledProject(install, 'npm', key);
    const count = Object.keys(listToolProjectPins(toolConfigurations).npm).length;
    return `installed ${formatCount(count, 'npm tool')} in ${GSPOT_PATHS.nodeModules} (${packageManager.name} ${packageManager.version})`;
}

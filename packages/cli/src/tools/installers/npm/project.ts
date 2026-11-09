import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import semver from 'semver';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER, PACKAGE_JSON } from '#cli/config/parsers.ts';
import { CI_NODE, VERSION_FLAG } from '#cli/config/repository/javascript.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { TRAILING_PERIOD } from '#cli/config/settings/validation.ts';
import {
    INSTALL_FAILURE,
    LOCKFILE_CREDENTIAL_MESSAGE,
    LOCKFILE_FAILURE,
    NODE_MISSING_MESSAGE,
    NODE_TOOL,
    NPM_CONFIG_FOLDER_VARIABLE,
    NPM_DEFAULT_REGISTRY,
    NPM_LOCKFILE_CREDENTIAL_MESSAGE,
    NPM_SETTING_PREFIX,
    NPM_TOOL_NOUN,
    NPM_USER_CONFIG_VARIABLE,
    NPMRC_FILE,
    PACKAGE_MANAGER_ARGUMENTS,
    PACKAGE_MANAGER_SETTINGS_NAME,
    RELEASE_AGE_VERSIONS,
} from '#cli/config/tools/installers.ts';
import { buildPackageManagerCommand } from '#cli/repository/javascript/package-manager.ts';
import { GspotError } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { findProgram } from '#cli/system/programs.ts';
import { formatCount } from '#cli/system/text.ts';
import { assertCredentialFreeLockfile, redactInstallOutput } from '#cli/tools/installers/credentials.ts';
import { isLockfileFresh, selectLockfileName, stripBunRegistryUrls } from '#cli/tools/installers/npm/lockfiles.ts';
import { extractRegistryCredentials, writeNpmrc } from '#cli/tools/installers/npm/registry.ts';
import { prepareReleaseAge, writeBunReleaseAge } from '#cli/tools/installers/npm/release-age.ts';
import { explainReleaseAgeHold, runInstallStep } from '#cli/tools/installers/steps.ts';
import { listPackagePins } from '#cli/tools/pins.ts';
import type { ReplacementRequest } from '#cli/types/repository.ts';
import type {
    GeneratedFile,
    NpmToolInstall,
    PackageManagerRequest,
    PackageManagerRun,
    ToolInstall,
    ToolPackageManagerName,
    ToolRelease,
} from '#cli/types/tools.ts';

const LOCK_ONLY_FLAG = '--package-lock-only';

const PACKAGE_MANAGER_UPGRADES: Record<ToolPackageManagerName, string> = {
    npm: 'npm install --global npm@latest',
    pnpm: 'pnpm self-update',
    bun: 'bun upgrade',
};

const DELETED_LOCKFILE_MESSAGE =
    'npm wrote registry credentials into the lockfile of the tool project, so gspot deleted that lockfile. Remove the credentials from the registry URL, then run gspot install again.';

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
        packageManager,
        commandArguments: prepareReleaseAge(lockfileArguments, packageManager, install.releaseAgeDays),
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
        const registry = env[`${NPM_SETTING_PREFIX}registry`] ?? NPM_DEFAULT_REGISTRY;
        const releases = Object.entries(listPackagePins(install.session.toolConfigurations).npm).map(
            ([name, version]): ToolRelease => ({
                label: `${name}@${version}`,
                kind: 'npm',
                version,
                url: new URL(name.replace('/', '%2f'), registry.endsWith('/') ? registry : `${registry}/`).href,
            }),
        );
        const explanation = await explainReleaseAgeHold(install, output, releases);
        const exit = result.signal === undefined ? `exit ${String(result.code)}` : `stopped by ${result.signal}`;
        throw new GspotError('install', `${explanation}${packageManager.name} ${failure} (${exit}).\n${output}`);
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
*/
export async function assertPackageManagerVersion(install: ToolInstall): Promise<void> {
    const { session, packageManager } = install;
    if (packageManager === undefined) return;
    const versionCommand = buildPackageManagerCommand(packageManager.command, [VERSION_FLAG], CI_NODE);
    const version = await runInstallStep(install, versionCommand, { cwd: session.root });
    const requirement = `${String(semver.major(packageManager.version))}.x`;
    const found = version.stdout.trim();
    if (version.code === 0 && semver.satisfies(found, requirement, { includePrerelease: true })) {
        const minimum = RELEASE_AGE_VERSIONS[packageManager.name];
        if (semver.lt(found, minimum)) {
            const fix =
                packageManager.command.version === undefined
                    ? `Run ${PACKAGE_MANAGER_UPGRADES[packageManager.name]}.`
                    : `Change the ${packageManager.name} version that package.json pins.`;
            throw new GspotError(
                'install',
                `gspot needs ${packageManager.name} ${minimum} or later, which holds back new releases for dependencies.min_release_age_days. Found ${found}. ${fix}`,
            );
        }
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

export async function planNpmLockfile(
    install: NpmToolInstall,
    toolProjectFile: GeneratedFile,
): Promise<ReplacementRequest> {
    const lockfile = selectLockfileName(install.packageManager.name);
    const path = `${GSPOT_FOLDER}/${lockfile}`;
    const previous = install.writer.read(path);
    if (previous !== undefined && isNpmLockfileFresh(install)) {
        const bytes = Buffer.from(previous.bytes.toString('utf8'));
        return { path, next: { bytes, mode: OWNER_WRITABLE_FILE }, previous: previous };
    }
    const content = await createNpmLockfile(install, { toolProjectFile, lockfileName: lockfile });
    return { path, next: { bytes: Buffer.from(content), mode: OWNER_WRITABLE_FILE }, previous: previous };
}

export function isNpmLockfileFresh(install: NpmToolInstall): boolean {
    const { packageManager, registryEnvironment } = install;
    const saved = install.writer.read(`${GSPOT_FOLDER}/${selectLockfileName(packageManager.name)}`);
    if (saved === undefined) return false;
    const text = saved.bytes.toString('utf8');
    const credentials = extractRegistryCredentials(registryEnvironment);
    assertCredentialFreeLockfile(text, credentials, NPM_LOCKFILE_CREDENTIAL_MESSAGE);
    const dependencies = listPackagePins(install.session.toolConfigurations).npm;
    return isLockfileFresh(packageManager.name, text, dependencies, registryEnvironment);
}

/**
Resolve and install the npm tool project in one npm run in .gspot, when its lockfile is missing or stale. The run
starts with no lockfile and no node_modules folder, so npm resolves the tree as a lock run in an empty folder does, and
writes the lockfile that later installs read. A lockfile that holds credentials is deleted, and the error stays.
*/
export async function installUnlockedNpmTools(install: NpmToolInstall): Promise<string> {
    if (findProgram(NODE_TOOL) === undefined) throw new GspotError('install', NODE_MISSING_MESSAGE);
    const { root, toolConfigurations } = install.session;
    const { packageManager, writer } = install;
    const path = `${GSPOT_FOLDER}/${selectLockfileName(packageManager.name)}`;
    assertSettingsFree(install);
    writer.deleteTree(GSPOT_PATHS.nodeModules);
    if (writer.findStats(path) !== undefined) writer.deleteFile(path);
    const lockArguments = PACKAGE_MANAGER_ARGUMENTS.npm.lockfile.filter((argument) => argument !== LOCK_ONLY_FLAG);
    const run = await runPackageManager(install, {
        runFolder: join(root, GSPOT_FOLDER),
        packageManager,
        commandArguments: prepareReleaseAge(lockArguments, packageManager, install.releaseAgeDays),
        failure: INSTALL_FAILURE,
        environment: install.registryEnvironment,
    });
    try {
        assertCredentialFreeLockfile(readFileSync(join(root, path), 'utf8'), run.credentials, DELETED_LOCKFILE_MESSAGE);
    } catch (error) {
        writer.deleteFile(path);
        throw error;
    }
    const count = Object.keys(listPackagePins(toolConfigurations).npm).length;
    return `installed ${formatCount(count, NPM_TOOL_NOUN)} in ${GSPOT_PATHS.nodeModules} (${packageManager.name} ${packageManager.version})`;
}

export async function installNpmTools(install: NpmToolInstall): Promise<string> {
    const { root, toolConfigurations } = install.session;
    const packageManager = install.packageManager;
    assertSettingsFree(install);
    const installArguments = PACKAGE_MANAGER_ARGUMENTS[packageManager.name].install;
    await runPackageManager(install, {
        runFolder: join(root, GSPOT_FOLDER),
        packageManager,
        // pnpm holds new releases back by default, so its install needs the hold and the exclusions of the lock step.
        commandArguments:
            packageManager.name === 'pnpm'
                ? prepareReleaseAge(installArguments, packageManager, install.releaseAgeDays)
                : [...installArguments],
        failure: INSTALL_FAILURE,
        environment: install.registryEnvironment,
    });
    const count = Object.keys(listPackagePins(toolConfigurations).npm).length;
    return `installed ${formatCount(count, NPM_TOOL_NOUN)} in ${GSPOT_PATHS.nodeModules} (${packageManager.name} ${packageManager.version})`;
}

import which from 'which';
import semver from 'semver';
import { join } from 'node:path';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { runInstallStep } from '#cli/install/steps.ts';
import { VERSION_FLAG } from '#cli/config/tools/versions.ts';
import { writeYarnSettings } from '#cli/install/npm/yarn.ts';
import { rmSync, readFileSync, writeFileSync } from 'node:fs';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import { getTable, findRootScope } from '#cli/settings/scopes.ts';
import { prepareReleaseAge } from '#cli/install/npm/release-age.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { parseToolPackageJson } from '#cli/install/npm/package-json.ts';
import { type NpmToolProject } from '#cli/types/install/tool-projects.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { buildPackageManagerCommand } from '#cli/repository/npm/package-manager.ts';
import { isLockfileFresh, stripBunRegistryUrls } from '#cli/install/npm/lockfiles.ts';
import { redactInstallOutput, assertCredentialFreeLockfile } from '#cli/install/credentials.ts';
import { RELEASE_AGE_FILES, RELEASE_AGE_VERSIONS } from '#cli/config/install/npm/release-age.ts';
import { YARN_SETTINGS_FILE, YARN_INSTALL_SETTINGS_FILE } from '#cli/config/install/npm/yarn.ts';
import { writeNpmrc, readRegistryEnvironment, extractRegistryCredentials } from '#cli/install/npm/registry.ts';
import { type NpmToolInstall, type PackageManagerRun, type PackageManagerCommand } from '#cli/types/install/npm.ts';

import {
    NODE_TOOL,
    NPMRC_FILE,
    NPM_SETTING_PREFIX,
    YARN_ENABLE_SCRIPTS,
    PACKAGE_MANAGER_ARGUMENTS,
    NPM_CONFIG_FOLDER_VARIABLE,
    YARN_SETTINGS_FILE_VARIABLE,
} from '#cli/config/install/npm/project.ts';

async function createNpmLockfile(
    install: NpmToolInstall,
    toolProjectFile: GeneratedFile,
    project: NpmToolProject,
    recorded: string | undefined,
    yarn: string | undefined,
): Promise<string> {
    const packageManager = install.packageManager;
    if (which.sync(NODE_TOOL, { nothrow: true }) === null)
        throw new GspotError('install', 'The npm tool project needs Node.js to create its lockfile. Install Node.js.');
    using scratch = createTemporaryFolder();
    const runFolder = scratch.path;
    writeFileSync(join(runFolder, PACKAGE_JSON), toolProjectFile.content);
    const env = await readRegistryEnvironment(install.session.root);

    if (yarn !== undefined) writeFileSync(join(runFolder, YARN_SETTINGS_FILE), yarn);
    if (recorded !== undefined && isLockfileFresh(packageManager.name, recorded, project.dependencies, env))
        writeFileSync(join(runFolder, project.lockfile), recorded);
    const lockfileArguments = PACKAGE_MANAGER_ARGUMENTS[packageManager.name].lockfile;
    const days = getTable(findRootScope(install.session.scopes).settings, 'dependencies').min_release_age_days;
    const run = await runPackageManager(install, {
        runFolder,
        packageManager,
        commandArguments: prepareReleaseAge(runFolder, lockfileArguments, packageManager, days),
        failure: 'lockfile resolution failed',
        days,
    });
    const lockfilePath = join(runFolder, project.lockfile);
    let lockfile = readFileSync(lockfilePath, 'utf8');
    assertCredentialFreeLockfile(
        lockfile,
        run.credentials,
        'The package manager wrote registry credentials into its lockfile. gspot kept the existing files.',
    );
    if (packageManager.name === 'bun') lockfile = stripBunRegistryUrls(lockfile, run.env);
    if (!isLockfileFresh(packageManager.name, lockfile, project.dependencies, run.env))
        throw new GspotError(
            'install',
            `${packageManager.name} wrote a tool lockfile that does not match the tool project. gspot kept the existing files.`,
        );
    return lockfile;
}

async function runPackageManager(install: ToolInstall, request: PackageManagerCommand): Promise<PackageManagerRun> {
    const { root } = install.session;
    const { runFolder, packageManager, commandArguments, failure, days } = request;
    const env = await readRegistryEnvironment(root);
    const credentials = extractRegistryCredentials(env);
    using settings = createTemporaryFolder();
    try {
        writeNpmrc(settings.path, env);
        env[`${NPM_SETTING_PREFIX}userconfig`] = join(settings.path, NPMRC_FILE);
        env[NPM_CONFIG_FOLDER_VARIABLE] = settings.path;
        if (packageManager.name === 'yarn') {
            env[YARN_ENABLE_SCRIPTS] = '0';
            credentials.push(...(await writeYarnSettings(install, runFolder, env, days)));
            env[YARN_SETTINGS_FILE_VARIABLE] = YARN_INSTALL_SETTINGS_FILE;
        }
        const projectPackageManager = install.session.packageManager;
        const commandPackageManager =
            projectPackageManager?.name === packageManager.name ? projectPackageManager : { name: packageManager.name };
        const args = [...commandArguments];
        if (packageManager.name === 'bun') {
            prepareReleaseAge(settings.path, args, packageManager, days);
            args.push(`--config=${join(settings.path, RELEASE_AGE_FILES.bun)}`);
        }
        const command = buildPackageManagerCommand(commandPackageManager, args.slice(1));
        const result = await runInstallStep(install, command, { cwd: runFolder, env });
        if (result.code !== 0) {
            throw new GspotError(
                'install',
                `${packageManager.name} ${failure} (exit ${String(result.code)}).\n${redactInstallOutput(result, credentials)}`,
            );
        }
        return { env, credentials };
    } finally {
        rmSync(join(runFolder, YARN_INSTALL_SETTINGS_FILE), { force: true });
    }
}

/**
Verify the package manager executable before install changes any tool project file.

@param install the tool install of this step.
*/
export async function assertPackageManagerVersion(install: ToolInstall): Promise<void> {
    const { session } = install;
    const packageManager = install.packageManager;
    if (packageManager === undefined) return;
    const { root } = session;
    const projectPackageManager = session.packageManager;
    const commandPackageManager =
        projectPackageManager?.name === packageManager.name ? projectPackageManager : { name: packageManager.name };
    const versionCommand = buildPackageManagerCommand(commandPackageManager, [VERSION_FLAG]);
    const version = await runInstallStep(install, versionCommand, { cwd: root });
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
@param yarn the generated Yarn settings text, if any.

@returns the lockfile and its recorded bytes.
*/
export async function prepareNpmLockfile(
    install: NpmToolInstall,
    toolProjectFile: GeneratedFile,
    yarn: string | undefined,
): Promise<GeneratedFile> {
    const { root } = install.session;
    const owner = install.writer;
    const packageManager = install.packageManager;
    const project = parseToolPackageJson(toolProjectFile.content, packageManager.name);
    const original = owner.read(project.lockfilePath);
    const recorded = original?.bytes.toString('utf8');
    const env = await readRegistryEnvironment(root);
    if (recorded !== undefined)
        assertCredentialFreeLockfile(
            recorded,
            extractRegistryCredentials(env),
            'The npm lockfile holds the registry credentials of the repository. gspot kept the existing files. Remove the credentials from the registry URL.',
        );
    if (
        owner.read(GSPOT_PATHS.npmProject)?.bytes.equals(Buffer.from(toolProjectFile.content)) === true &&
        recorded !== undefined &&
        isLockfileFresh(packageManager.name, recorded, project.dependencies, env)
    ) {
        return { path: project.lockfilePath, content: recorded, kind: 'lock', read: original };
    }
    const lockfile = await createNpmLockfile(install, toolProjectFile, project, recorded, yarn);
    return { path: project.lockfilePath, content: lockfile, kind: 'lock', read: original };
}

/**
Install the npm tool project in .gspot.

@param install what install needs for this step.
@returns the install summary.
*/
export async function installNpmTools(install: NpmToolInstall): Promise<string> {
    const { session } = install;
    const { root } = session;
    const owner = install.writer;
    const toolProjectFile = owner.read(GSPOT_PATHS.npmProject);
    if (toolProjectFile === undefined) return '';
    const packageManager = install.packageManager;
    const project = parseToolPackageJson(toolProjectFile.bytes.toString('utf8'), packageManager.name);
    owner.deleteTree(GSPOT_PATHS.nodeModules);
    const runFolder = join(root, DOT_GSPOT);
    await runPackageManager(install, {
        runFolder,
        packageManager,
        commandArguments: [...PACKAGE_MANAGER_ARGUMENTS[packageManager.name].install],
        failure: 'installation failed',
        days: getTable(findRootScope(session.scopes).settings, 'dependencies').min_release_age_days,
    });
    return `installed ${formatCount(Object.keys(project.dependencies).length, 'npm tool')} in ${GSPOT_PATHS.nodeModules} (${packageManager.name} ${packageManager.version})`;
}

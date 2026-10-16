import which from 'which';
import semver from 'semver';
import { join } from 'node:path';
import { GspotError } from '#cli/errors.ts';
import { runTool } from '#cli/tools/run.ts';
import { scratchFolder } from '#cli/system/files.ts';
import { yarnSettings } from '#cli/tools/npm/yarn.ts';
import type { Session } from '#cli/types/planning.ts';
import { VERSION_FLAG } from '#cli/config/tools/run.ts';
import { NPM_BIN_FOLDER } from '#cli/config/tools/find.ts';
import { executableNames } from '#cli/system/executables.ts';
import { sourcePath } from '#cli/system/safe-folder/reads.ts';
import { REINSTALL_HINT } from '#cli/config/tools/diagnostics.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { SafeFolder } from '#cli/types/system/safe-folder.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import type { NpmClient } from '#cli/types/parsers/dependency-files.ts';
import { isYarnBerry, npmClientMajor } from '#cli/parsers/npm-client.ts';
import { toolVersionState, parseVersionOutput } from '#cli/tools/versions.ts';
import { lockfileMatches, stripRegistryUrls } from '#cli/tools/npm/lockfiles.ts';
import { parseToolProject, toolProjectLockfile } from '#cli/parsers/tool-project.ts';
import { rmSync, existsSync, realpathSync, readFileSync, writeFileSync } from 'node:fs';
import { installationDiagnostics, assertCredentialFreeLockfile } from '#cli/tools/diagnostics.ts';
import { writeNpmrc, registryEnvironment, registryCredentials } from '#cli/tools/npm/registry.ts';
import { DOT_GSPOT, NPM_TOOL_PROJECT_FILE, NODE_MODULES_DIRECTORY } from '#cli/config/system/locations.ts';
import type { NpmClientRun, NpmToolProject, NpmClientCommands, NpmClientExecution } from '#cli/types/tools/project.ts';

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
async function resolveNpmLockfile(
    manifest: GeneratedFile,
    project: NpmToolProject,
    recorded: string | undefined,
    preparation: Pick<Session, 'root' | 'timeoutSeconds'>,
    yarn: string | undefined,
    steps: (readonly string[])[],
): Promise<string> {
    const { root, timeoutSeconds } = preparation;
    if (which.sync(NODE_TOOL, { nothrow: true }) === null)
        throw new GspotError(
            'installation',
            'node is required by the npm tool project. Install it before it creates its lockfile.',
        );
    using scratch = scratchFolder();
    const work = scratch.path;
    writeFileSync(join(work, PACKAGE_JSON), manifest.content);

    if (yarn !== undefined) writeFileSync(join(work, '.yarnrc.yml'), yarn);
    if (recorded !== undefined && lockfileMatches(project.npmClient.name, recorded, project.dependencies))
        writeFileSync(join(work, project.lockfile), recorded);
    const env = await runNpmClient({
        root,
        work,
        client: project.npmClient,
        argv: npmClientCommands(project.npmClient).lockfile,
        failure: 'lockfile resolution failed',
        timeoutSeconds,
        steps,
    });
    stripRegistryUrls(work, project.npmClient, env);
    const lockfile = readFileSync(join(work, project.lockfile), 'utf8');
    if (!lockfileMatches(project.npmClient.name, lockfile, project.dependencies))
        throw new GspotError(
            'installation',
            `${project.npmClient.name} produced a mismatched tool lockfile. Existing files were preserved.`,
        );
    return lockfile;
}

// An npm wrapper can declare a package version different from its executable version.
function needsVersionCheck(tool: ToolDeclaration, dependencies: Record<string, string>): boolean {
    const npm = tool.installers['npm'];
    if (tool.kind === 'library' || npm?.version === undefined || tool.version === undefined) return false;
    return npm.version !== tool.version && dependencies[npm.name] === npm.version;
}

async function assertWrapperVersion(
    work: string,
    executable: string,
    tool: ToolDeclaration,
    timeoutSeconds: number,
    steps: (readonly string[])[],
): Promise<void> {
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
    if (toolVersionState(read.version, want, floor) === 'outdated')
        throw new GspotError(
            'installation',
            `${tool.name} reported ${read.version}, below ${floor}. Tool installation is incomplete. Run: gspot install`,
        );
}

// An npm wrapper such as editorconfig-checker downloads its program the first time it runs. Run it here, so
// the download happens during install, and check the version it reports.
async function runNpmWrappersOnce(
    work: string,
    dependencies: Record<string, string>,
    selected: Iterable<ToolDeclaration>,
    timeoutSeconds: number,
    steps: (readonly string[])[],
): Promise<void> {
    const root = realpathSync(work);
    // Select the first Windows wrapper that exists: an npm command file or a Bun executable.
    for (const tool of selected) {
        if (!needsVersionCheck(tool, dependencies)) continue;
        const name =
            executableNames(tool.name).find((candidate) => existsSync(join(work, NPM_BIN_FOLDER, candidate))) ??
            tool.name;
        await assertWrapperVersion(work, sourcePath(root, `${NPM_BIN_FOLDER}/${name}`), tool, timeoutSeconds, steps);
    }
}

/**
 * The resolution and immutable-install argv for the selected package manager.
 *
 * @param client the declared package manager and major.
 *
 * @returns both actual package operations.
 */
function npmClientCommands(client: NpmClient): NpmClientCommands {
    const yarn = isYarnBerry(client) ? YARN_ARGUMENTS.berry : YARN_ARGUMENTS.classic;
    const args =
        client.name === 'yarn'
            ? yarn
            : { lockfile: LOCKFILE_ARGUMENTS[client.name], install: INSTALL_ARGUMENTS[client.name] };
    return { lockfile: [...args.lockfile], install: [...args.install] };
}

/**
 * Execute a package operation and validate its complete lockfile before publication.
 *
 * @param request the package-manager operation, routing, and process limits.
 *
 * @returns validated lockfile bytes and the private routing environment.
 */
async function runNpmClient(request: NpmClientExecution): Promise<NpmClientRun> {
    const { root, work, client, argv, failure, timeoutSeconds, steps } = request;
    const env = await registryEnvironment(root);
    const credentials = registryCredentials(env);
    using settings = scratchFolder();
    try {
        writeNpmrc(settings.path, env);
        env[`${NPM_SETTING_PREFIX}userconfig`] = join(settings.path, NPMRC_FILE);
        env[NPM_CONFIG_DIRECTORY_VARIABLE] = settings.path;
        const berry = isYarnBerry(client);
        if (berry) delete env['YARN_REGISTRY'];
        if (berry) {
            credentials.push(...(await yarnSettings(root, work, env, timeoutSeconds, steps)));
            env['YARN_RC_FILENAME'] = YARN_INSTALL_SETTINGS_FILE;
        }
        steps.push(argv);
        const result = await runTool(argv, { cwd: work, env, timeoutSeconds });
        if (result.code !== 0) {
            throw new GspotError(
                'installation',
                `${client.name} ${failure} (exit ${String(result.code)}). ${REINSTALL_HINT}.\n${installationDiagnostics(result, credentials)}`,
            );
        }
        const lockfile = readFileSync(join(work, toolProjectLockfile(client.name)), 'utf8');
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
 * @param client the package manager declaration.
 * @param version the executable's version response.
 * @returns nothing.
 */
function assertNpmClientVersion(client: NpmClient, version: SpawnResult): void {
    const requirement = `${String(npmClientMajor(client))}.x`;
    if (version.code !== 0 || !semver.satisfies(version.stdout.trim(), requirement, { includePrerelease: true }))
        throw new GspotError(
            'tool',
            `The tool project requires ${client.name}@${requirement}. Install that package manager version first.`,
        );
}

/**
 * Prepare the npm tool project's credential-free lockfile.
 *
 * @param manifest the generated package.json.
 * @param owner the repository reader.
 * @param preparation repository routing, selected npm client, and the tool timeout.
 * @param yarn the generated Yarn settings.
 * @param steps the commands attempted during lockfile creation.
 *
 * @returns the lockfile and its recorded bytes.
 */
async function prepareNpmLockfile(
    manifest: GeneratedFile,
    owner: Pick<SafeFolder, 'read'>,
    preparation: Pick<Session, 'root' | 'npmClient' | 'timeoutSeconds'>,
    yarn: string | undefined,
    steps: (readonly string[])[],
): Promise<GeneratedFile> {
    const { root } = preparation;
    const project = parseToolProject(manifest.content, preparation.npmClient() as NpmClient);
    const original = owner.read(project.lockfilePath);
    const recorded = original?.bytes.toString('utf8');
    if (
        owner.read(NPM_TOOL_PROJECT_FILE)?.bytes.equals(Buffer.from(manifest.content)) === true &&
        recorded !== undefined &&
        lockfileMatches(project.npmClient.name, recorded, project.dependencies)
    ) {
        assertCredentialFreeLockfile(
            recorded,
            registryCredentials(await registryEnvironment(root)),
            new GspotError(
                'installation',
                'The npm lockfile includes repository registry credentials. Existing files were preserved. Remove credentials from the registry URL and run: gspot install',
            ),
        );
        return {
            path: project.lockfilePath,
            content: recorded,
            kind: 'lock',
            ...(original === undefined ? {} : { read: original }),
        };
    }
    const lockfile = await resolveNpmLockfile(manifest, project, recorded, preparation, yarn, steps);
    return {
        path: project.lockfilePath,
        content: lockfile,
        kind: 'lock',
        ...(original === undefined ? {} : { read: original }),
    };
}

/**
 * Install the npm tool project in .gspot.
 *
 * @param session the repository root, selected npm client, and the tool timeout.
 * @param owner the repository reader.
 * @param tools selected package wrappers.
 * @param steps the commands attempted during installation.
 *
 * @returns the installation summary.
 */
async function installNpmTools(
    session: Pick<Session, 'root' | 'npmClient' | 'timeoutSeconds'>,
    owner: Pick<SafeFolder, 'read' | 'removeTree'>,
    tools: Iterable<ToolDeclaration>,
    steps: (readonly string[])[],
): Promise<string> {
    const { root, timeoutSeconds } = session;
    const manifest = owner.read(NPM_TOOL_PROJECT_FILE);
    if (manifest === undefined) return '';
    const project = parseToolProject(manifest.bytes.toString('utf8'), session.npmClient() as NpmClient);
    const lockfile = owner.read(project.lockfilePath)?.bytes.toString('utf8');
    if (lockfile === undefined || !lockfileMatches(project.npmClient.name, lockfile, project.dependencies))
        throw new GspotError('installation', 'Run: gspot install');
    const versionCommand = [project.npmClient.name, VERSION_FLAG];
    steps.push(versionCommand);
    const version = await runTool(versionCommand, { cwd: root, timeoutSeconds });
    assertNpmClientVersion(project.npmClient, version);
    owner.removeTree(NODE_MODULES_DIRECTORY);
    const work = join(root, DOT_GSPOT);
    await runNpmClient({
        root,
        work,
        client: project.npmClient,
        argv: npmClientCommands(project.npmClient).install,
        failure: 'installation failed',
        timeoutSeconds,
        steps,
    });
    await runNpmWrappersOnce(work, project.dependencies, tools, timeoutSeconds, steps);
    return `installed locked npm tools under .gspot/node_modules with ${project.npmClient.name}@${project.npmClient.version}`;
}

export { installNpmTools, prepareNpmLockfile };

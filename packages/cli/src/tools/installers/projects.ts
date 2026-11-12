import { join } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { MISE_TOOL, UV_PROJECT_INSTALL_ARGUMENTS, UV_REINSTALL_FLAG, UV_TOOL } from '#cli/config/tools/installers.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { planReplacements, writePlans } from '#cli/repository/writer.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findProgram } from '#cli/system/programs.ts';
import { isMiseLockfileFresh } from '#cli/tools/installers/mise.ts';
import { isLockfileFresh, selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';
import {
    installNpmTools,
    installUnlockedNpmTools,
    isNpmLockfileFresh,
    planNpmLockfile,
} from '#cli/tools/installers/npm/project.ts';
import { readRegistryEnvironment } from '#cli/tools/installers/npm/registry.ts';
import {
    installPythonProjects,
    installPythonTools,
    isPythonLockfileFresh,
    listLockedPythonProjects,
    planPythonLockfile,
} from '#cli/tools/installers/pypi.ts';
import { runInstallStep } from '#cli/tools/installers/steps.ts';
import { listExecutablePaths } from '#cli/tools/locate.ts';
import {
    buildPythonProjectTable,
    findPackagePin,
    listMisePins,
    listNpmProjectPins,
    listPackagePins,
} from '#cli/tools/pins.ts';
import type { Tool } from '#cli/types/manifests.ts';
import type { ReplacementRequest, ToolPackageManagerName } from '#cli/types/repository.ts';
import type { Files } from '#cli/types/system.ts';
import type {
    GeneratedFile,
    NpmToolInstall,
    Session,
    StaleLockfile,
    ToolInstall,
    ToolProjectsInstall,
} from '#cli/types/tools.ts';

const UV_CHECK_FLAG = '--check';

function findStaleMiseLockfile(files: Files, configurations: Session['toolConfigurations']): StaleLockfile | undefined {
    const path = GSPOT_PATHS.miseLockfile;
    const saved = files.read(path);
    if (isMiseLockfileFresh(listMisePins(configurations), saved?.bytes.toString('utf8'))) return undefined;
    return { path, kind: saved === undefined ? 'absent' : 'changed' };
}

function findStaleNpmLockfile(
    files: Files,
    packageManager: ToolPackageManagerName,
    session: Pick<Session, 'scopes' | 'toolConfigurations'>,
): StaleLockfile | undefined {
    const path = `${GSPOT_FOLDER}/${selectLockfileName(packageManager)}`;
    const saved = files.read(path);
    if (saved === undefined) return { path, kind: 'absent' };
    return isLockfileFresh(packageManager, saved.bytes.toString('utf8'), listNpmProjectPins(session))
        ? undefined
        : { path, kind: 'changed' };
}

function findStalePythonLockfile(
    files: Files,
    configurations: Session['toolConfigurations'],
): StaleLockfile | undefined {
    const path = GSPOT_PATHS.uvLockfile;
    const saved = files.read(path);
    if (saved === undefined) return { path, kind: 'absent' };
    const isFresh = isPythonLockfileFresh(buildPythonProjectTable(configurations), saved.bytes.toString('utf8'));
    return isFresh ? undefined : { path, kind: 'changed' };
}

async function findUvPath(install: ToolInstall, miseBinPaths: string[]): Promise<string | undefined> {
    const { session, misePath } = install;
    if (misePath === undefined && findProgram(UV_TOOL) === undefined) return undefined;
    const search = { folders: [], miseBinPaths, timeoutSeconds: session.settings.tool_timeout_seconds };
    const { paths } = await listExecutablePaths(session.toolsRoot, UV_TOOL, search);
    return paths[0] ?? UV_TOOL;
}

/**
Install the npm tool project. Bun keeps the packages that a new lockfile drops, so a changed lockfile installs into an
empty node_modules folder.
*/
async function installNpmProject(npm: NpmToolInstall, lockfiles: ReplacementRequest[]): Promise<string> {
    const lockfile = `${GSPOT_FOLDER}/${selectLockfileName(npm.packageManager.name)}`;
    const plan = lockfiles.find(({ path }) => path === lockfile);
    if (plan !== undefined && plan.previous?.bytes.equals(plan.next.bytes) !== true)
        npm.writer.deleteTree(GSPOT_PATHS.nodeModules);
    return installNpmTools(npm);
}

export async function isEveryEnvironmentReady(install: ToolInstall, miseBinPaths: string[]): Promise<boolean> {
    const { root } = install.session;
    const folders = listLockedPythonProjects(install.session);
    if (folders.length === 0 || install.runsProjectInstall === false) return true;
    const uvPath = await findUvPath(install, miseBinPaths);
    if (uvPath === undefined) return false;
    const files = openFiles(root);
    const results = await Promise.all(
        folders.map(async (folder) => {
            if (files.findStats(joinScope(folder, PYTHON_ENVIRONMENT_FOLDER))?.isDirectory() !== true) return false;
            const command = [uvPath, ...UV_PROJECT_INSTALL_ARGUMENTS, UV_CHECK_FLAG];
            const result = await runInstallStep(install, command, { cwd: join(root, folder) });
            return result.code === 0;
        }),
    );
    return results.every(Boolean);
}

/**
List the state of each tool project lockfile: whether it exists and names every pin at its version. It resolves and
writes nothing, and it reads no package manager settings. With no mise on PATH, gspot install cannot write the mise
lockfile, so that lockfile counts as current.
*/
export function listStaleLockfiles(
    session: Pick<Session, 'root' | 'scopes' | 'toolPackageManager' | 'toolConfigurations'>,
    generated: GeneratedFile[],
): StaleLockfile[] {
    const { root, toolPackageManager, toolConfigurations } = session;
    const projects = new Set(generated.map((file) => file.path));
    const files = openFiles(root);
    const lockfiles: Array<StaleLockfile | undefined> = [];
    if (projects.has(GSPOT_PATHS.miseProject) && findProgram(MISE_TOOL) !== undefined)
        lockfiles.push(findStaleMiseLockfile(files, toolConfigurations));
    if (toolPackageManager !== undefined && projects.has(GSPOT_PATHS.npmProject))
        lockfiles.push(findStaleNpmLockfile(files, toolPackageManager, session));
    if (projects.has(GSPOT_PATHS.pythonProject)) lockfiles.push(findStalePythonLockfile(files, toolConfigurations));
    return lockfiles.filter((lockfile): lockfile is StaleLockfile => lockfile !== undefined);
}

/**
Tell whether install can keep every tool lockfile. It reads what a lock run reads and `listStaleLockfiles` does not:
the npm registry settings, the uv indexes, and the release age.
*/
export async function isEveryLockfileFresh(install: ToolInstall): Promise<boolean> {
    const { session, writer, packageManager } = install;
    const configurations = session.toolConfigurations;
    if (install.misePath !== undefined && findStaleMiseLockfile(writer, configurations) !== undefined) return false;
    if (packageManager !== undefined) {
        const registryEnvironment = await readRegistryEnvironment(session.root);
        if (!isNpmLockfileFresh({ ...install, packageManager, registryEnvironment })) return false;
    }
    if (install.generated.files.every((file) => file.path !== GSPOT_PATHS.pythonProject)) return true;
    return isPythonLockfileFresh(
        buildPythonProjectTable(configurations),
        writer.read(GSPOT_PATHS.uvLockfile)?.bytes.toString('utf8'),
        install.pythonSettings.settings,
        install.releaseAgeDays,
    );
}

/**
Resolve the npm tool lockfile, then install the frozen npm tool project. A changed lockfile installs into an empty
node_modules folder. With npm, a missing or stale lockfile resolves and installs in one npm run. The npm project needs
no tool that mise installs, so it can install beside them.
*/
export async function installNpmToolProject(install: ToolInstall): Promise<ToolProjectsInstall> {
    const { session, writer, tools, packageManager } = install;
    if (packageManager === undefined) return { installed: [], tools: [] };
    const npm = { ...install, packageManager, registryEnvironment: await readRegistryEnvironment(session.root) };
    const npmTools = tools.filter((tool) => tool.system !== true && findPackagePin(tool)?.kind === 'npm');
    const project = install.generated.files.find((file) => file.path === GSPOT_PATHS.npmProject);
    if (project !== undefined && packageManager.name === 'npm' && !isNpmLockfileFresh(npm))
        return { installed: [await installUnlockedNpmTools(npm)], tools: npmTools };
    const lockfiles = project === undefined ? [] : [await planNpmLockfile(npm, project)];
    writePlans(writer, planReplacements(writer, lockfiles));
    return { installed: [await installNpmProject(npm, lockfiles)], tools: npmTools };
}

export async function installPythonToolProjects(
    install: ToolInstall,
    miseBinPaths: string[],
): Promise<ToolProjectsInstall> {
    const { session, writer, tools } = install;
    const uvPath = await findUvPath(install, miseBinPaths);
    if (uvPath === undefined) return { installed: [], tools: [] };
    const installed: string[] = [];
    const project = install.generated.files.find((file) => file.path === GSPOT_PATHS.pythonProject);
    const lockfiles = project === undefined ? [] : [await planPythonLockfile(install, project, uvPath)];
    writePlans(writer, planReplacements(writer, lockfiles));
    if (listPackagePins(session.toolConfigurations).python.length > 0)
        installed.push(await installPythonTools(install, uvPath));
    if (install.runsProjectInstall !== false) installed.push(...(await installPythonProjects(install, uvPath)));
    return {
        installed,
        tools: tools.filter((tool) => tool.system !== true && findPackagePin(tool)?.kind === 'python'),
    };
}

export async function repairToolProjects(install: ToolInstall, miseBinPaths: string[], tools: Tool[]): Promise<void> {
    const kinds = new Set(tools.map((tool) => findPackagePin(tool)?.kind));
    const { session, packageManager } = install;
    if (packageManager !== undefined && kinds.has('npm')) {
        install.writer.deleteTree(GSPOT_PATHS.nodeModules);
        await installNpmTools({
            ...install,
            packageManager,
            registryEnvironment: await readRegistryEnvironment(session.root),
        });
    }
    const uvPath = kinds.has('python') ? await findUvPath(install, miseBinPaths) : undefined;
    if (uvPath !== undefined) await installPythonTools(install, uvPath, [UV_REINSTALL_FLAG]);
}

import which from 'which';
import type { Files } from '#cli/types/system.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { listExecutablePaths } from '#cli/tools/locate.ts';
import type { ReplacementRequest } from '#cli/types/repository.ts';
import { isMiseLockfileFresh } from '#cli/tools/installers/mise.ts';
import { writePlans, planReplacements } from '#cli/repository/writer.ts';
import { UV_TOOL, UV_REINSTALL_FLAG } from '#cli/config/tools/installers.ts';
import { readRegistryEnvironment } from '#cli/tools/installers/npm/registry.ts';
import { installNpmTools, planNpmLockfile } from '#cli/tools/installers/npm/project.ts';
import { isLockfileFresh, selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';

import {
    listMisePins,
    findPackagePin,
    listPackagePins,
    listNpmProjectPins,
    buildPythonProjectTable,
} from '#cli/tools/pins.ts';
import {
    installPythonTools,
    planPythonLockfile,
    installPythonProjects,
    isPythonLockfileFresh,
} from '#cli/tools/installers/pypi.ts';
import type {
    Session,
    ToolInstall,
    GeneratedFile,
    StaleLockfile,
    NpmToolInstall,
    ToolProjectsInstall,
    ToolPackageManagerName,
} from '#cli/types/tools.ts';

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
    const matches = isPythonLockfileFresh(buildPythonProjectTable(configurations), saved.bytes.toString('utf8'));
    return matches ? undefined : { path, kind: 'changed' };
}

async function planLockfiles(
    install: ToolInstall,
    { npm, uvPath }: { npm: NpmToolInstall | undefined; uvPath: string | undefined },
): Promise<ReplacementRequest[]> {
    const { files } = install.generated;
    const packages = files.find((file) => file.path === GSPOT_PATHS.npmProject);
    const python = files.find((file) => file.path === GSPOT_PATHS.pythonProject);
    return [
        ...(packages === undefined || npm === undefined ? [] : [await planNpmLockfile(npm, packages)]),
        ...(python === undefined || uvPath === undefined ? [] : [await planPythonLockfile(install, python, uvPath)]),
    ];
}

/**
List the state of each tool project lockfile: whether it exists and names every pin at its version. It resolves and
writes nothing, and it reads no package manager settings.

@param session the repository, its tool configurations, and its package manager.
@param generated the tool project files that apply writes.
*/
export function listStaleLockfiles(
    session: Pick<Session, 'root' | 'scopes' | 'toolPackageManager' | 'toolConfigurations'>,
    generated: GeneratedFile[],
): StaleLockfile[] {
    const { root, toolPackageManager, toolConfigurations } = session;
    const projects = new Set(generated.map((file) => file.path));
    const files = openFiles(root);
    const lockfiles: Array<StaleLockfile | undefined> = [];
    if (projects.has(GSPOT_PATHS.miseProject)) lockfiles.push(findStaleMiseLockfile(files, toolConfigurations));
    if (projects.has(GSPOT_PATHS.npmProject) && toolPackageManager !== undefined)
        lockfiles.push(findStaleNpmLockfile(files, toolPackageManager, session));
    if (projects.has(GSPOT_PATHS.pythonProject)) lockfiles.push(findStalePythonLockfile(files, toolConfigurations));
    return lockfiles.filter((lockfile): lockfile is StaleLockfile => lockfile !== undefined);
}

async function findUvPath(install: ToolInstall, miseBinPaths: string[]): Promise<string | undefined> {
    const { session, misePath } = install;
    if (misePath === undefined && which.sync(UV_TOOL, { nothrow: true }) === null) return undefined;
    const search = { folders: [], miseBinPaths, timeoutSeconds: session.settings.tool_timeout_seconds };
    const { paths } = await listExecutablePaths(session.toolsRoot, UV_TOOL, search);
    return paths[0] ?? UV_TOOL;
}

async function buildNpmInstall(install: ToolInstall): Promise<NpmToolInstall | undefined> {
    const { session, packageManager } = install;
    if (packageManager === undefined) return undefined;
    return { ...install, packageManager, registryEnvironment: await readRegistryEnvironment(session.root) };
}

/**
Resolve the owned lockfiles, then install the frozen npm and Python tool projects.

@param install what install needs for this step.
@param miseBinPaths the program folders that mise installed, where uv may sit.
*/
export async function installToolProjects(install: ToolInstall, miseBinPaths: string[]): Promise<ToolProjectsInstall> {
    const { session, writer, tools } = install;
    const installed: string[] = [];
    const uvPath = await findUvPath(install, miseBinPaths);
    const npm = await buildNpmInstall(install);
    const lockfiles = await planLockfiles(install, { npm, uvPath });
    writePlans(writer, planReplacements(writer, lockfiles));
    if (npm !== undefined) installed.push(await installNpmTools(npm));
    if (uvPath !== undefined && listPackagePins(session.toolConfigurations).python.length > 0)
        installed.push(await installPythonTools(install, uvPath));
    if (uvPath !== undefined) installed.push(...(await installPythonProjects(install, uvPath)));
    const kinds = new Set([npm === undefined ? undefined : 'npm', uvPath === undefined ? undefined : 'python']);
    kinds.delete(undefined);
    return { installed, tools: tools.filter((tool) => tool.system !== true && kinds.has(findPackagePin(tool)?.kind)) };
}

/**
Install the tool projects of these tools again in the forced form: npm tools in a fresh node_modules folder, and Python
tools with uv's reinstall.

@param install what install needs for this step.
@param miseBinPaths the program folders that mise installed, where uv may sit.
@param tools the tools that failed their inspection.
*/
export async function repairToolProjects(install: ToolInstall, miseBinPaths: string[], tools: Tool[]): Promise<void> {
    const kinds = new Set(tools.map((tool) => findPackagePin(tool)?.kind));
    const npm = kinds.has('npm') ? await buildNpmInstall(install) : undefined;
    if (npm !== undefined) {
        install.writer.deleteTree(GSPOT_PATHS.nodeModules);
        await installNpmTools(npm);
    }
    const uvPath = kinds.has('python') ? await findUvPath(install, miseBinPaths) : undefined;
    if (uvPath !== undefined) await installPythonTools(install, uvPath, [UV_REINSTALL_FLAG]);
}

import which from 'which';
import type { Files } from '#cli/types/system.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { UV_TOOL } from '#cli/config/tools/installers.ts';
import { listExecutablePaths } from '#cli/tools/locate.ts';
import { listMisePins, listPackagePins } from '#cli/tools/pins.ts';
import { isMiseLockfileFresh } from '#cli/tools/installers/mise.ts';
import { writePlans, planReplacements } from '#cli/repository/writer.ts';
import { readRegistryEnvironment } from '#cli/tools/installers/npm/registry.ts';
import type { PackageManager, ReplacementRequest } from '#cli/types/repository.ts';
import { installNpmTools, planNpmLockfile } from '#cli/tools/installers/npm/project.ts';
import { isLockfileFresh, selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';
import type { Session, ToolInstall, GeneratedFile, StaleLockfile, NpmToolInstall } from '#cli/types/tools.ts';

import {
    installPythonTools,
    planPythonLockfile,
    isPythonLockfileFresh,
    buildPythonProjectTable,
} from '#cli/tools/installers/pypi.ts';

function readMiseLockfileState(files: Files, configurations: Session['toolConfigurations']): StaleLockfile | undefined {
    const path = GSPOT_PATHS.miseLockfile;
    const saved = files.read(path);
    if (isMiseLockfileFresh(listMisePins(configurations), saved?.bytes.toString('utf8'))) return undefined;
    return { path, kind: saved === undefined ? 'absent' : 'changed' };
}

function readNpmLockfileState(
    files: Files,
    packageManager: Exclude<PackageManager['name'], 'yarn'>,
    configurations: Session['toolConfigurations'],
): StaleLockfile | undefined {
    const path = `${GSPOT_FOLDER}/${selectLockfileName(packageManager)}`;
    const saved = files.read(path);
    if (saved === undefined) return { path, kind: 'absent' };
    const dependencies = listPackagePins(configurations).npm;
    return isLockfileFresh(packageManager, saved.bytes.toString('utf8'), dependencies)
        ? undefined
        : { path, kind: 'changed' };
}

function readPythonLockfileState(
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
    session: Pick<Session, 'root' | 'packageManager' | 'toolConfigurations'>,
    generated: GeneratedFile[],
): StaleLockfile[] {
    const { root, packageManager, toolConfigurations } = session;
    const projects = new Set(generated.map((file) => file.path));
    const files = openFiles(root);
    const lockfiles: (StaleLockfile | undefined)[] = [];
    if (projects.has(GSPOT_PATHS.miseProject)) lockfiles.push(readMiseLockfileState(files, toolConfigurations));
    if (projects.has(GSPOT_PATHS.npmProject) && packageManager !== undefined) {
        const name = packageManager.name === 'yarn' ? 'npm' : packageManager.name;
        lockfiles.push(readNpmLockfileState(files, name, toolConfigurations));
    }
    if (projects.has(GSPOT_PATHS.pythonProject)) lockfiles.push(readPythonLockfileState(files, toolConfigurations));
    return lockfiles.filter((lockfile): lockfile is StaleLockfile => lockfile !== undefined);
}

/**
Resolve the owned lockfiles, then install the frozen npm and Python tool projects.

@param install what install needs for this step.
@param miseBinPaths the program folders that mise installed, where uv may sit.
*/
export async function installToolProjects(install: ToolInstall, miseBinPaths: string[]): Promise<string[]> {
    const { session, writer, misePath: mise, packageManager } = install;
    const notes: string[] = [];
    const uvPath =
        mise !== undefined || which.sync(UV_TOOL, { nothrow: true }) !== null
            ? (listExecutablePaths(session.toolsRoot, UV_TOOL, {
                  folders: [],
                  miseBinPaths,
                  timeoutSeconds: session.timeoutSeconds,
              })[0] ?? UV_TOOL)
            : undefined;
    const npm =
        packageManager === undefined
            ? undefined
            : { ...install, packageManager, registryEnvironment: await readRegistryEnvironment(session.root) };
    const lockfiles = await planLockfiles(install, { npm, uvPath });
    writePlans(writer, planReplacements(writer, lockfiles));
    if (npm !== undefined) notes.push(await installNpmTools(npm));
    if (uvPath !== undefined && listPackagePins(session.toolConfigurations).python.length > 0)
        notes.push(await installPythonTools(install, uvPath));
    return notes;
}

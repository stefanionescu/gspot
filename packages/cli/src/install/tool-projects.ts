import which from 'which';
import { getUvPath } from '#cli/tools/locate.ts';
import type { Session } from '#cli/types/session.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { isMiseLockfileFresh } from '#cli/install/mise.ts';
import { writePlans, planReplacement } from '#cli/write.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import { isLockfileFresh } from '#cli/install/npm/lockfiles.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { readPythonSettings } from '#cli/install/python/settings.ts';
import { readRegistryEnvironment } from '#cli/install/npm/registry.ts';
import { parseToolPackageJson } from '#cli/install/npm/package-json.ts';
import type { StaleLockfile } from '#cli/types/install/tool-projects.ts';
import { toolPyprojectSchema } from '#cli/schemas/install/python/project.ts';
import { installNpmTools, prepareNpmLockfile } from '#cli/install/npm/project.ts';
import { selectToolPackageManager } from '#cli/repository/npm/package-manager.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';
import { installPythonTools, preparePythonLockfile, isPythonLockfileFresh } from '#cli/install/python/project.ts';

function setLockfile(files: GeneratedFile[], lockfile: GeneratedFile): void {
    const index = files.findIndex((file) => file.path === lockfile.path);
    if (index === -1) files.push(lockfile);
    else files[index] = lockfile;
}

function readNpmLockfileState(
    files: Files,
    name: PackageManager['name'],
    toolProjectFile: GeneratedFile,
    env: Record<string, string>,
): StaleLockfile {
    const project = parseToolPackageJson(toolProjectFile.content, name);
    const path = project.lockfilePath;
    const recorded = files.read(path);
    if (recorded === undefined) return { path, kind: 'missing' };
    const matches = isLockfileFresh(name, recorded.bytes.toString('utf8'), project.dependencies, env);
    return matches ? { path } : { path, kind: 'changed' };
}

/**
List the state of each tool project lockfile. It resolves and writes nothing.

@param session the repository and its package manager.
@param generated the tool project files that apply writes.
@returns each lockfile with its state: missing, mismatched, or current.
*/
export async function listStaleLockfiles(
    session: Pick<Session, 'root' | 'installedRoot' | 'packageManager' | 'timeoutSeconds' | 'reads'>,
    generated: GeneratedFile[],
): Promise<StaleLockfile[]> {
    const { root } = session;
    const env = generated.some((file) => file.path === GSPOT_PATHS.npmProject)
        ? await readRegistryEnvironment(root)
        : {};
    const indexes = generated.some((file) => file.path === GSPOT_PATHS.pythonProject)
        ? readPythonSettings(root).settings
        : {};
    using files = openFiles(root);
    const mise = generated.find(({ path }) => path === GSPOT_PATHS.miseProject);
    const miseLock = files.read(GSPOT_PATHS.miseLockfile);
    const miseState: StaleLockfile[] =
        mise === undefined || isMiseLockfileFresh(mise.content, miseLock?.bytes.toString('utf8'))
            ? []
            : [{ path: GSPOT_PATHS.miseLockfile, kind: miseLock === undefined ? 'missing' : 'changed' }];
    return [
        ...miseState,
        ...generated
            .filter(
                (toolProjectFile) =>
                    toolProjectFile.path === GSPOT_PATHS.npmProject ||
                    toolProjectFile.path === GSPOT_PATHS.pythonProject,
            )
            .flatMap((toolProjectFile) => {
                if (toolProjectFile.path === GSPOT_PATHS.npmProject) {
                    if (session.packageManager === undefined) return [];
                    const name = selectToolPackageManager(
                        session.installedRoot,
                        session.packageManager,
                        session.timeoutSeconds,
                        session.reads,
                    );
                    return [readNpmLockfileState(files, name, toolProjectFile, env)];
                }
                const project = toolPyprojectSchema.parse(parseToml(toolProjectFile.content));
                const path = GSPOT_PATHS.uvLockfile;
                const recorded = files.read(path);
                if (recorded === undefined) return [{ path, kind: 'missing' as const }];
                const matches = isPythonLockfileFresh(project, recorded.bytes.toString('utf8'), indexes);
                return matches ? [{ path }] : [{ path, kind: 'changed' as const }];
            }),
    ];
}

async function prepareLockfiles(install: ToolInstall, files: GeneratedFile[]): Promise<void> {
    const packages = files.find((file) => file.path === GSPOT_PATHS.npmProject);
    const python = files.find((file) => file.path === GSPOT_PATHS.pythonProject);
    if (packages !== undefined && install.packageManager !== undefined)
        setLockfile(
            files,
            await prepareNpmLockfile(
                { ...install, packageManager: install.packageManager },
                packages,
                files.find((file) => file.path === GSPOT_PATHS.yarnSettings)?.content,
            ),
        );
    if (python !== undefined) setLockfile(files, await preparePythonLockfile(install, python));
}

/**
Resolve the owned lockfiles, then install the frozen npm and Python tool projects.

@param install what install needs for this step.

@returns the npm and Python install notes.
*/
export async function installToolProjects(install: ToolInstall): Promise<string[]> {
    const { session, writer, generated, misePath: mise } = install;
    const configurations = session.toolConfigurations;
    const notes: string[] = [];
    const uvPath = mise !== null || which.sync(UV_TOOL, { nothrow: true }) !== null ? getUvPath(session) : undefined;
    const toolProjectFiles =
        uvPath === undefined
            ? generated.files.filter((file) => file.path !== GSPOT_PATHS.pythonProject)
            : generated.files;
    await prepareLockfiles(install, toolProjectFiles);
    writePlans(
        writer,
        toolProjectFiles
            .filter((file) => file.kind === 'lock')
            .map((file) =>
                planReplacement(writer, {
                    path: file.path,
                    next: { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE },
                    expected: file.read,
                }),
            ),
    );
    if (install.packageManager !== undefined) {
        notes.push(await installNpmTools({ ...install, packageManager: install.packageManager }));
    }
    if (uvPath !== undefined && listToolProjectPins(configurations).python.length > 0) {
        notes.push(await installPythonTools(install, uvPath));
    }
    return notes;
}

import which from 'which';
import { JSON_INDENT } from '#cli/config/text.ts';
import { UV_TOOL } from '#cli/config/tools/uv.ts';
import { compareText } from '#cli/system/text.ts';
import { stringify } from '@decimalturn/toml-patch';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { listExecutablePaths } from '#cli/tools/locate.ts';
import { writePlans, planReplacements } from '#cli/write.ts';
import { isMiseLockfileFresh } from '#cli/installers/mise.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { type Configuration } from '#cli/types/configurations.ts';
import type { NpmToolInstall } from '#cli/types/installers/npm.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { ToolInstall } from '#cli/types/installers/install.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { StaleLockfile } from '#cli/types/installers/projects.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/toml.ts';
import type { PythonIndexSettings } from '#cli/types/installers/pypi.ts';
import { readRegistryEnvironment } from '#cli/installers/npm/registry.ts';
import { listMisePins, listToolProjectPins } from '#cli/configurations/tools.ts';
import { selectToolPackageManager } from '#cli/repository/npm/package-manager.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';
import { installNpmTools, prepareNpmLockfile } from '#cli/installers/npm/project.ts';
import { isLockfileFresh, selectLockfileName } from '#cli/installers/npm/lockfiles.ts';
import { NPM_TOOL_PROJECT, UV_PROJECT_TABLE, YARN_TOOL_PROJECT_SETTINGS } from '#cli/config/installers/projects.ts';

import {
    readPythonSettings,
    installPythonTools,
    preparePythonLockfile,
    isPythonLockfileFresh,
    buildPythonProjectTable,
} from '#cli/installers/pypi.ts';

function readMiseLockfileState(files: Files, configurations: Session['toolConfigurations']): StaleLockfile {
    const path = GSPOT_PATHS.miseLockfile;
    const saved = files.read(path);
    if (isMiseLockfileFresh(listMisePins(configurations), saved?.bytes.toString('utf8'))) return { path };
    return { path, kind: saved === undefined ? 'missing' : 'changed' };
}

function readNpmLockfileState(
    files: Files,
    name: PackageManager['name'],
    configurations: Session['toolConfigurations'],
    env: Record<string, string>,
): StaleLockfile {
    const path = `${DOT_GSPOT}/${selectLockfileName(name)}`;
    const saved = files.read(path);
    if (saved === undefined) return { path, kind: 'missing' };
    const dependencies = listToolProjectPins(configurations).npm;
    return isLockfileFresh(name, saved.bytes.toString('utf8'), dependencies, env)
        ? { path }
        : { path, kind: 'changed' };
}

function readPythonLockfileState(
    files: Files,
    configurations: Session['toolConfigurations'],
    indexes: PythonIndexSettings['settings'],
): StaleLockfile {
    const path = GSPOT_PATHS.uvLockfile;
    const saved = files.read(path);
    if (saved === undefined) return { path, kind: 'missing' };
    const matches = isPythonLockfileFresh(
        buildPythonProjectTable(configurations),
        saved.bytes.toString('utf8'),
        indexes,
    );
    return matches ? { path } : { path, kind: 'changed' };
}

/**
List the state of each tool project lockfile. It resolves and writes nothing.

@param session the repository, its tool configurations, and its package manager.
@param generated the tool project files that apply writes.
@returns each lockfile with its state: missing, mismatched, or current.
*/
export async function listStaleLockfiles(
    session: Pick<Session, 'root' | 'toolsRoot' | 'packageManager' | 'timeoutSeconds' | 'reads' | 'toolConfigurations'>,
    generated: GeneratedFile[],
): Promise<StaleLockfile[]> {
    const { root, packageManager, toolConfigurations } = session;
    const projects = new Set(generated.map((file) => file.path));
    using files = openFiles(root);
    const lockfiles: StaleLockfile[] = [];
    if (projects.has(GSPOT_PATHS.miseProject)) lockfiles.push(readMiseLockfileState(files, toolConfigurations));
    if (projects.has(GSPOT_PATHS.npmProject) && packageManager !== undefined) {
        const name = selectToolPackageManager(session.toolsRoot, packageManager, session.timeoutSeconds, session.reads);
        lockfiles.push(readNpmLockfileState(files, name, toolConfigurations, await readRegistryEnvironment(root)));
    }
    if (projects.has(GSPOT_PATHS.pythonProject))
        lockfiles.push(readPythonLockfileState(files, toolConfigurations, readPythonSettings(root).settings));
    return lockfiles;
}

async function prepareLockfiles(
    install: ToolInstall,
    { npm, uvPath }: { npm: NpmToolInstall | undefined; uvPath: string | undefined },
): Promise<GeneratedFile[]> {
    const { files } = install.generated;
    const packages = files.find((file) => file.path === GSPOT_PATHS.npmProject);
    const python = files.find((file) => file.path === GSPOT_PATHS.pythonProject);
    const yarn = files.find((file) => file.path === GSPOT_PATHS.yarnSettings)?.content;
    return [
        ...(packages === undefined || npm === undefined ? [] : [await prepareNpmLockfile(npm, packages, yarn)]),
        ...(python === undefined || uvPath === undefined ? [] : [await preparePythonLockfile(install, python, uvPath)]),
    ];
}

/**
Resolve the owned lockfiles, then install the frozen npm and Python tool projects.

@param install what install needs for this step.
@param miseBinPaths the program folders that mise installed, where uv may sit.

@returns the npm and Python install notes.
*/
export async function installToolProjects(install: ToolInstall, miseBinPaths: string[]): Promise<string[]> {
    const { session, writer, misePath: mise, packageManager } = install;
    const notes: string[] = [];
    const uvPath =
        mise !== null || which.sync(UV_TOOL, { nothrow: true }) !== null
            ? (listExecutablePaths(session.toolsRoot, UV_TOOL, {
                  searchFolders: [],
                  miseBinPaths,
                  timeoutSeconds: session.timeoutSeconds,
              })[0] ?? UV_TOOL)
            : undefined;
    const npm =
        packageManager === undefined
            ? undefined
            : { ...install, packageManager, registryEnvironment: await readRegistryEnvironment(session.root) };
    const lockfiles = await prepareLockfiles(install, { npm, uvPath });
    writePlans(
        writer,
        planReplacements(
            writer,
            lockfiles.map((file) => ({
                path: file.path,
                next: { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE },
                expected: file.read,
            })),
        ),
    );
    if (npm !== undefined) notes.push(await installNpmTools(npm));
    if (uvPath !== undefined && listToolProjectPins(session.toolConfigurations).python.length > 0)
        notes.push(await installPythonTools(install, uvPath));
    return notes;
}

/**
Build the mise tool project without the runtime pins of the repository.

@param configurations the configurations in use.

@returns the mise tool project.
*/
export function buildMiseProject(configurations: Configuration[]): GeneratedFile {
    const tools = Object.fromEntries(
        listMisePins(configurations)
            .toSorted((left, right) => compareText(left.name, right.name))
            .map((pin) => [
                pin.name,
                pin.options === undefined ? pin.version : { version: pin.version, ...pin.options },
            ]),
    );
    return {
        path: GSPOT_PATHS.miseProject,
        content: stringify(
            { tools, settings: { lockfile: true } },
            { ...CONFIG_FILE_TOML_FORMAT, inlineTableStart: 1 },
        ),
    };
}

/**
Build the npm tools as a tool project, and add no dependencies to the repository.

@param configurations the configurations with npm tools.
@param packageManager the package manager of the tool project after mapping Yarn Classic to npm.

@returns the tool project files.
*/
export function buildNpmProject(
    configurations: Configuration[],
    packageManager: PackageManager['name'],
): GeneratedFile[] {
    const pins = listToolProjectPins(configurations).npm;
    const files: GeneratedFile[] = [
        {
            path: GSPOT_PATHS.npmProject,
            content: `${JSON.stringify(
                {
                    ...NPM_TOOL_PROJECT,
                    devDependencies: pins,
                },
                null,
                JSON_INDENT,
            )}\n`,
        },
    ];
    if (packageManager === 'yarn')
        files.push({
            path: GSPOT_PATHS.yarnSettings,
            content: YARN_TOOL_PROJECT_SETTINGS,
        });
    return files;
}

/**
Build the Python tool project that holds the Python lint tools.

@param configurations the configurations in use.
@param days the minimum release age, so uv installs no release newer than that.
@returns the Python tool project files, or none without Python tools.
*/
export function buildPythonProject(configurations: Configuration[], days: number): GeneratedFile[] {
    const project = buildPythonProjectTable(configurations);
    if (project.dependencies.length === 0) return [];
    return [
        {
            path: GSPOT_PATHS.pythonProject,
            content:
                stringify({ project }, CONFIG_FILE_TOML_FORMAT) +
                `\n${UV_PROJECT_TABLE}\n` +
                stringify({ package: false, 'exclude-newer': `${String(days)} days` }, CONFIG_FILE_TOML_FORMAT),
        },
    ];
}

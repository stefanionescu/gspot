import which from 'which';
import { getUvPath } from '#cli/tools/locate.ts';
import type { Session } from '#cli/types/session.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { writePlans } from '#cli/ownership/writer.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { isLockfileCurrent } from '#cli/install/npm/lockfiles.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { parseToolPackageJson } from '#cli/install/npm/tool-project.ts';
import type { StaleLockfile } from '#cli/types/install/tool-projects.ts';
import { listToolProjectPins } from '#cli/configurations/declared-tools.ts';
import { toolPyprojectSchema } from '#cli/schemas/install/python/project.ts';
import { assertPackageManager } from '#cli/repository/npm/package-manager.ts';
import { installNpmTools, prepareNpmLockfile } from '#cli/install/npm/project.ts';
import { installPythonTools, preparePythonLockfile, isPythonLockfileCurrent } from '#cli/install/python/project.ts';

import {
    UV_LOCKFILE,
    YARN_SETTINGS,
    NPM_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/gspot-paths.ts';

// Preparation may replace a lockfile in the command's generated files.
function setLockfile(files: GeneratedFile[], lockfile: GeneratedFile): void {
    const index = files.findIndex((file) => file.path === lockfile.path);
    if (index === -1) files.push(lockfile);
    else files[index] = lockfile;
}

/**
 * List the state of each tool project lockfile. Nothing gets resolved or written.
 *
 * @param session the repository and its package manager.
 * @param generated the tool project files that apply writes.
 *
 * @returns each lockfile with its state: missing, mismatched, or current.
 */
export function listStaleLockfiles(
    session: Pick<Session, 'root' | 'packageManager'>,
    generated: GeneratedFile[],
): StaleLockfile[] {
    const { root } = session;
    using files = openFiles(root);
    return generated
        .filter(
            (toolProjectFile) =>
                toolProjectFile.path === NPM_TOOL_PROJECT_FILE || toolProjectFile.path === PYTHON_TOOL_PROJECT_FILE,
        )
        .flatMap((toolProjectFile) => {
            if (toolProjectFile.path === NPM_TOOL_PROJECT_FILE) {
                const name = assertPackageManager(session.packageManager).name;
                const project = parseToolPackageJson(toolProjectFile.content, name);
                const path = project.lockfilePath;
                const recorded = files.read(path);
                if (recorded === undefined) return [{ path, kind: 'missing' as const }];
                const matches = isLockfileCurrent(name, recorded.bytes.toString('utf8'), project.dependencies);
                return matches ? [{ path }] : [{ path, kind: 'changed' as const }];
            }
            const project = toolPyprojectSchema.parse(parseToml(toolProjectFile.content));
            const path = UV_LOCKFILE;
            const recorded = files.read(path);
            if (recorded === undefined) return [{ path, kind: 'missing' as const }];
            const matches = isPythonLockfileCurrent(project, recorded.bytes.toString('utf8'));
            return matches ? [{ path }] : [{ path, kind: 'changed' as const }];
        });
}

/**
 * Add the npm and Python lockfiles before the generated files get written.
 *
 * @param install what install needs for this step.
 * @param files the generated list to add to.
 */
async function prepareLockfiles(install: ToolInstall, files: GeneratedFile[]): Promise<void> {
    const packages = files.find((file) => file.path === NPM_TOOL_PROJECT_FILE);
    const python = files.find((file) => file.path === PYTHON_TOOL_PROJECT_FILE);
    if (packages !== undefined)
        setLockfile(
            files,
            await prepareNpmLockfile(install, packages, files.find((file) => file.path === YARN_SETTINGS)?.content),
        );
    if (python !== undefined) setLockfile(files, await preparePythonLockfile(install, python));
}

/**
 * Resolve the owned lockfiles, then install the frozen npm and Python tool projects.
 *
 * @param install what install needs for this step.
 *
 * @returns the npm and Python install notes.
 */
export async function installSandboxTools(install: ToolInstall): Promise<string[]> {
    const { session, writer, generated, misePath: mise } = install;
    const configurations = session.neededToolConfigurations;
    const notes: string[] = [];
    const uvPath = mise !== null || which.sync(UV_TOOL, { nothrow: true }) !== null ? getUvPath(session) : undefined;
    const toolProjectFiles =
        uvPath === undefined
            ? generated.files.filter((file) => file.path !== PYTHON_TOOL_PROJECT_FILE)
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
    if (session.packageManager?.name !== undefined) {
        notes.push(await installNpmTools(install));
    }
    if (uvPath !== undefined && listToolProjectPins(configurations).python.length > 0) {
        notes.push(await installPythonTools(install, uvPath));
    }
    return notes;
}

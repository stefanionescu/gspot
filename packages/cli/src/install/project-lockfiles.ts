// Prepare and check the npm and Python tool-project lockfiles.
import { openFiles } from '#cli/system/files/open.ts';
import type { Session } from '#cli/types/planning.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
import { prepareNpmLockfile } from '#cli/install/npm/project.ts';
import { isLockfileCurrent } from '#cli/install/npm/lockfiles.ts';
import { parseToolProject } from '#cli/install/npm/tool-project.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { StaleLockfile, PythonToolProject } from '#cli/types/tools/project.ts';

import {
    preparePythonLockfile,
    pythonToolProjectSchema,
    isPythonLockfileCurrent,
} from '#cli/install/python/project.ts';
import {
    UV_LOCKFILE,
    YARN_SETTINGS,
    NPM_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';

// Preparation may replace a lockfile in the command's generated files.
function recordLockfile(files: GeneratedFile[], lockfile: GeneratedFile): void {
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
    session: Pick<Session, 'root' | 'requirePackageManagerName'>,
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
            const npm =
                toolProjectFile.path === NPM_TOOL_PROJECT_FILE
                    ? parseToolProject(toolProjectFile.content, session.requirePackageManagerName())
                    : undefined;
            const python =
                toolProjectFile.path === PYTHON_TOOL_PROJECT_FILE
                    ? pythonToolProjectSchema.parse(parseToml(toolProjectFile.content))
                    : undefined;
            const path = npm === undefined ? UV_LOCKFILE : npm.lockfilePath;
            const recorded = files.read(path);
            if (recorded === undefined) return [{ path, kind: 'missing' as const }];
            const content = recorded.bytes.toString('utf8');
            const matches =
                npm === undefined
                    ? isPythonLockfileCurrent(python as PythonToolProject, content)
                    : isLockfileCurrent(session.requirePackageManagerName(), content, npm.dependencies);
            return matches ? [{ path }] : [{ path, kind: 'changed' as const }];
        });
}

/**
 * Add the npm and Python lockfiles before the generated files get written.
 *
 * @param context what install needs for this step.
 * @param files the generated list to add to.
 */
export async function prepareLockfiles(context: InstallContext, files: GeneratedFile[]): Promise<void> {
    const packages = files.find((file) => file.path === NPM_TOOL_PROJECT_FILE);
    const python = files.find((file) => file.path === PYTHON_TOOL_PROJECT_FILE);
    if (packages !== undefined)
        recordLockfile(
            files,
            await prepareNpmLockfile(context, packages, files.find((file) => file.path === YARN_SETTINGS)?.content),
        );
    if (python !== undefined) recordLockfile(files, await preparePythonLockfile(context, python));
}

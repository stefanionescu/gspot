// Prepare and check the npm and Python tool-project lockfiles.
import { openFiles } from '#cli/system/files/open.ts';
import type { Session } from '#cli/types/planning.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { parse as parseToml } from '@decimalturn/toml-patch';
// eslint-disable-next-line import-x/no-cycle -- reason: Lockfile orchestration and its producers share this hoisted result function within the tools module.
import { prepareNpmLockfile } from '#cli/tools/npm/project.ts';
import { type FileContents } from '#cli/types/system/files.ts';
import { isLockfileCurrent } from '#cli/tools/npm/lockfiles.ts';
import { parseToolProject } from '#cli/tools/npm/tool-project.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { StaleLockfile, PythonToolProject } from '#cli/types/tools/project.ts';
// eslint-disable-next-line import-x/no-cycle -- reason: Lockfile orchestration and its producers share this hoisted result function within the tools module.
import { preparePythonLockfile, pythonToolProjectSchema, isPythonLockfileCurrent } from '#cli/tools/python/project.ts';

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
 * @param session the repository root and the package manager.
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
 * Append selected npm and Python lockfiles before writing generated files.
 *
 * @param context the selected tools, repository writer, session, and command log.
 * @param files the generated files.
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

/**
 * Build a generated lockfile with its recorded replacement source.
 * @param path the repository-relative destination for the replacement bytes.
 * @param content the credential-free lockfile.
 * @param original the recorded copy, when the file exists.
 * @returns the replacement bytes with the previous file attached for write validation.
 */
export function buildLockfileResult(path: string, content: string, original: FileContents | undefined): GeneratedFile {
    return { path, content, kind: 'lock', ...(original === undefined ? {} : { read: original }) };
}

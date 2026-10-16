import { parse as parseToml } from 'smol-toml';
import { openFiles } from '#cli/system/files/open.ts';
import type { Session } from '#cli/types/planning.ts';
import type { Files } from '#cli/types/system/files.ts';
import { prepareNpmLockfile } from '#cli/tools/npm/project.ts';
import { isLockfileCurrent } from '#cli/tools/npm/lockfiles.ts';
import { parseToolProject } from '#cli/tools/npm/tool-project.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { preparePythonLockfile, isPythonLockfileCurrent } from '#cli/tools/python/project.ts';
import type { StaleLockfile, PythonToolProject, PythonPreparation } from '#cli/types/tools/project.ts';

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
 * Read lockfile drift for generated tool projects without resolving or writing.
 *
 * @param session the repository root and actual selected npm client.
 * @param generated the proposed project manifests.
 *
 * @returns missing, mismatched, or current lockfiles.
 */
export function listStaleLockfiles(
    session: Pick<Session, 'root' | 'requirePackageManager'>,
    generated: GeneratedFile[],
): StaleLockfile[] {
    const { root } = session;
    using files = openFiles(root);
    return generated
        .filter((manifest) => manifest.path === NPM_TOOL_PROJECT_FILE || manifest.path === PYTHON_TOOL_PROJECT_FILE)
        .flatMap((manifest) => {
            const npm =
                manifest.path === NPM_TOOL_PROJECT_FILE
                    ? parseToolProject(manifest.content, session.requirePackageManager().name)
                    : undefined;
            const python =
                manifest.path === PYTHON_TOOL_PROJECT_FILE
                    ? (parseToml(manifest.content) as PythonToolProject)
                    : undefined;
            const path = npm === undefined ? UV_LOCKFILE : npm.lockfilePath;
            const recorded = files.read(path);
            if (recorded === undefined) return [{ path, kind: 'missing' as const }];
            const content = recorded.bytes.toString('utf8');
            const matches =
                npm === undefined
                    ? isPythonLockfileCurrent(python as PythonToolProject, content)
                    : isLockfileCurrent(session.requirePackageManager().name, content, npm.dependencies);
            return matches ? [{ path }] : [{ path, kind: 'changed' as const }];
        });
}

/**
 * Append selected npm and Python lockfiles before writing generated files.
 *
 * @param preparation the root, uv executable, selected npm client, and time limit.
 * @param files the generated files.
 * @param owner the repository reader.
 * @param steps the commands attempted during lockfile creation.
 */
export async function prepareLockfiles(
    preparation: PythonPreparation & Pick<Session, 'requirePackageManager'>,
    files: GeneratedFile[],
    owner: Pick<Files, 'read'>,
    steps: (readonly string[])[],
): Promise<void> {
    const packages = files.find((file) => file.path === NPM_TOOL_PROJECT_FILE);
    const python = files.find((file) => file.path === PYTHON_TOOL_PROJECT_FILE);
    if (packages !== undefined)
        recordLockfile(
            files,
            await prepareNpmLockfile(
                packages,
                owner,
                preparation,
                files.find((file) => file.path === YARN_SETTINGS)?.content,
                steps,
            ),
        );
    if (python !== undefined) recordLockfile(files, await preparePythonLockfile(python, owner, preparation, steps));
}

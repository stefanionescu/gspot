import which from 'which';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { writePlans } from '#cli/ownership/writer.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { installNpmTools } from '#cli/install/npm/project.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { installPythonTools } from '#cli/install/python/project.ts';
import { prepareLockfiles } from '#cli/install/project-lockfiles.ts';
import { PYTHON_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';

/**
 * Resolve the owned lockfiles, then install the frozen npm and Python tool projects.
 *
 * @param context what install needs for this step.
 *
 * @returns the npm and Python install notes.
 */
export async function installToolProjects(context: InstallContext): Promise<string[]> {
    const { session, writer, generated, mise } = context;
    const manifests = session.neededToolManifests;
    const notes: string[] = [];
    const uvPath = mise !== null || which.sync(UV_TOOL, { nothrow: true }) !== null ? session.uvPath : undefined;
    const lockfileInputs =
        uvPath === undefined
            ? generated.files.filter((file) => file.path !== PYTHON_TOOL_PROJECT_FILE)
            : generated.files;
    await prepareLockfiles(context, lockfileInputs);
    writePlans(
        writer,
        lockfileInputs
            .filter((file) => file.kind === 'lock')
            .map((file) =>
                planReplacement(writer, {
                    path: file.path,
                    next: { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE },
                    canReplace: file.read !== undefined,
                    expected: file.read,
                }),
            ),
    );
    if (session.getPackageManagerName() !== undefined) {
        notes.push(await installNpmTools(context));
    }
    if (uvPath !== undefined && listToolProjectPins(manifests).python.length > 0) {
        notes.push(await installPythonTools(context, uvPath));
    }
    return notes;
}

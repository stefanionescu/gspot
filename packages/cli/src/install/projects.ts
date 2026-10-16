import which from 'which';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { writePlans } from '#cli/ownership/writer.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import { prepareLockfiles } from '#cli/tools/lockfiles.ts';
import { installNpmTools } from '#cli/tools/npm/project.ts';
import type { InstallContext } from '#cli/types/install.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { installPythonTools } from '#cli/tools/python/project.ts';
import { toolProjectPins } from '#cli/configurations/tool-pins.ts';
import { PYTHON_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';

/**
 * Resolve owned lockfiles, then install their frozen npm and Python projects.
 *
 * @param context the selected tools, session, writer, generated files, and attempted commands.
 *
 * @returns the npm and Python installation notes.
 */
export async function installToolProjects(context: InstallContext): Promise<string[]> {
    const { session, writer: log, generated, tools, mise, steps } = context;
    const manifests = session.neededToolManifests;
    const timeoutSeconds = session.timeoutSeconds;
    const notes: string[] = [];
    const uvPath = mise !== null || which.sync(UV_TOOL, { nothrow: true }) !== null ? session.uvPath : undefined;
    const lockfileInputs =
        uvPath === undefined
            ? generated.files.filter((file) => file.path !== PYTHON_TOOL_PROJECT_FILE)
            : generated.files;
    await prepareLockfiles(session, lockfileInputs, log.files, steps);
    writePlans(
        log,
        lockfileInputs
            .filter((file) => file.kind === 'lock')
            .map((file) =>
                planReplacement(log, {
                    path: file.path,
                    next: { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE },
                    canReplace: file.read !== undefined,
                    expected: file.read,
                }),
            ),
    );
    if (session.npmClient() !== undefined) {
        notes.push(await installNpmTools(session, log.files, tools, steps));
    }
    if (uvPath !== undefined && toolProjectPins(manifests).python.length > 0) {
        notes.push(await installPythonTools(session.root, log.files, uvPath, timeoutSeconds, steps));
    }
    return notes;
}

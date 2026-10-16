import which from 'which';
import { runTool } from '#cli/tools/run.ts';
import { UV_TOOL } from '#cli/config/tools/python.ts';
import { applyPlans } from '#cli/ownership/writer.ts';
import type { Session } from '#cli/types/planning.ts';
import { VERSION_FLAG } from '#cli/config/tools/run.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import { prepareLockfiles } from '#cli/tools/lockfiles.ts';
import type { OwnershipLog } from '#cli/types/ownership.ts';
import { TOOL_PROJECT_INPUTS } from '#cli/config/install.ts';
import type { ToolProjectInputs } from '#cli/types/install.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { installPythonTools } from '#cli/tools/python/project.ts';
import { toolProjectPins } from '#cli/configurations/tool-pins.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { PYTHON_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';
import { installNpmTools, assertNpmClientVersion } from '#cli/tools/npm/project.ts';

/**
 * Resolve owned lockfiles, then install their frozen npm and Python projects.
 *
 * @param session the repository session.
 * @param log the locked ownership log.
 * @param generated the generated files and edits.
 * @param tools the selected tool declarations.
 * @param mise the mise executable, or null when unavailable.
 * @param steps the commands attempted during installation.
 *
 * @returns the npm and Python installation notes.
 */
export async function installToolProjects(
    session: Session,
    log: OwnershipLog,
    generated: Generated,
    tools: ToolDeclaration[],
    mise: string | null,
    steps: (readonly string[])[],
): Promise<string[]> {
    const manifests = session.neededToolManifests;
    const timeoutSeconds = session.timeoutSeconds;
    const notes: string[] = [];
    const uvPath = mise !== null || which.sync(UV_TOOL, { nothrow: true }) !== null ? session.uvPath : undefined;
    const lockfileInputs =
        uvPath === undefined
            ? generated.files.filter((file) => file.path !== PYTHON_TOOL_PROJECT_FILE)
            : generated.files;
    await prepareLockfiles(session, lockfileInputs, log.files, steps);
    applyPlans(
        log,
        lockfileInputs
            .filter((file) => file.kind === 'lock')
            .map((file) =>
                planReplacement(log, {
                    path: file.path,
                    next: { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE },
                    kind: 'lock',
                    canReplace: file.read !== undefined,
                    expected: file.read,
                }),
            ),
    );
    if (session.npmClient() !== undefined) {
        notes.push(await installNpmTools(session, log.files, tools, steps));
    }
    if (uvPath !== undefined && toolProjectPins(manifests).python.length > 0) {
        notes.push(
            await installPythonTools(session.root, log.files, uvPath, session.cancelSignal, timeoutSeconds, steps),
        );
    }
    return notes;
}

/**
 * Write selected tool projects before their package managers read them.
 *
 * @param request the repository session, ownership log, source files, and attempted commands.
 * @returns nothing.
 */
export async function writeToolProjectInputs(request: ToolProjectInputs): Promise<void> {
    const { session, log, files, steps } = request;
    const client = session.npmClient();
    if (client !== undefined) {
        const command = [client.name, VERSION_FLAG];
        steps.push(command);
        const version = await runTool(command, {
            cwd: session.root,
            timeoutSeconds: session.timeoutSeconds,
            cancelSignal: session.cancelSignal,
        });
        session.cancelSignal?.throwIfAborted();
        assertNpmClientVersion(client, version);
    }
    const projects = files.filter((file) => new Set<string>(TOOL_PROJECT_INPUTS).has(file.path));
    applyPlans(
        log,
        projects.map((file) =>
            planReplacement(log, {
                path: file.path,
                next: { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE },
                kind: 'tool_file',
            }),
        ),
    );
}

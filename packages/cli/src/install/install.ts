import which from 'which';
import { GspotError } from '#cli/errors.ts';
import { rootView } from '#cli/settings/view.ts';
import { EXIT_ERROR } from '#cli/config/terminal.ts';
import { installHooks } from '#cli/install/hooks.ts';
import type { Session } from '#cli/types/planning.ts';
import { toolTimeoutSeconds } from '#cli/tools/run.ts';
import { installMiseTools } from '#cli/install/mise.ts';
import { installValePackages } from '#cli/install/vale.ts';
import type { OwnershipLog } from '#cli/types/ownership.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import type { InstallationResult } from '#cli/types/install.ts';
import { collectPins, toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { installToolProjects, writeToolProjectInputs } from '#cli/install/projects.ts';
import { TOOL_FOLDER_KINDS, INSTALLED_TOOL_FOLDERS } from '#cli/config/system/locations.ts';

function isInstallationFailure(error: unknown): error is GspotError {
    return error instanceof GspotError && (error.code === 'tool' || error.code === 'installation');
}

/**
 * Install selected tools in their repository projects and set the clone's hooks.
 *
 * @param session the repository session.
 * @param log the locked ownership log.
 * @param generated the selected tool projects.
 *
 * @returns commands run, the installation summary, and exit code.
 */
export async function installTools(
    session: Session,
    log: OwnershipLog,
    generated: Generated,
): Promise<InstallationResult> {
    const manifests = session.neededToolManifests;
    const steps: (readonly string[])[] = [];
    const notes: string[] = [];
    const timeoutSeconds = toolTimeoutSeconds(rootView(session.scopes));
    const tools = collectPins(manifests);
    const mise = which.sync('mise', { nothrow: true });
    try {
        await writeToolProjectInputs({ session, log, files: generated.files, steps });
        const programNote = await installMiseTools(session, tools, mise, steps);
        notes.push(...(await installToolProjects(session, log, generated, tools, mise, steps)));
        if (manifests.some((manifest) => manifest.tools.some((tool) => tool.name === 'vale'))) {
            notes.push(
                await installValePackages(
                    {
                        level: session.settingsFile.settings.level,
                        search: session,
                        tool: toolDeclaration(manifests, 'vale'),
                        timeoutSeconds,
                        cancelSignal: session.cancelSignal,
                    },
                    steps,
                ),
            );
        }
        notes.push(
            installHooks(
                {
                    settings: session.settingsFile.settings,
                    repository: session.repository,
                    runner: session.startRunner,
                },
                steps,
            ),
            programNote,
        );
        log.state.installed = TOOL_FOLDER_KINDS.filter(
            (kind) => log.files.stat(INSTALLED_TOOL_FOLDERS[kind])?.isDirectory() === true,
        );
        log.save();
        return { note: notes.filter(Boolean).join('; '), exitCode: 0, steps };
    } catch (error) {
        if (!isInstallationFailure(error)) throw error;
        return {
            note: `${error.message}\nTool installation is incomplete. Run: gspot install`,
            exitCode: EXIT_ERROR,
            steps,
        };
    }
}

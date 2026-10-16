import which from 'which';
import { GspotError } from '#cli/system/errors.ts';
import { findStaleFiles } from '#cli/apply/stale.ts';
import { EXIT_ERROR } from '#cli/config/terminal.ts';
import { installHooks } from '#cli/install/hooks.ts';
import type { Writer } from '#cli/types/ownership.ts';
import type { Session } from '#cli/types/planning.ts';
import { installMiseTools } from '#cli/install/mise.ts';
import { installValePackages } from '#cli/install/vale.ts';
import { TOOL_PROJECT_INPUTS } from '#cli/config/install.ts';
import { collectPins } from '#cli/configurations/tool-pins.ts';
import { installToolProjects } from '#cli/install/projects.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import type { InstallContext, InstallationResult } from '#cli/types/install.ts';

/**
 * Install selected tools in their repository projects and set the clone's hooks.
 *
 * @param session the repository session.
 * @param log the locked repository writer.
 * @param generated the selected tool projects.
 *
 * @returns commands run, the installation summary, and exit code.
 */
export async function installTools(session: Session, log: Writer, generated: Generated): Promise<InstallationResult> {
    const manifests = session.neededToolManifests;
    const steps: (readonly string[])[] = [];
    const notes: string[] = [];
    const tools = collectPins(manifests);
    const mise = which.sync('mise', { nothrow: true });
    const context: InstallContext = { session, writer: log, generated, tools, mise, steps };
    try {
        if (findStaleFiles(session, generated).some((file) => new Set<string>(TOOL_PROJECT_INPUTS).has(file.path)))
            throw new GspotError('installation', 'Run gspot apply first');
        const programNote = await installMiseTools(context);
        notes.push(...(await installToolProjects(context)));
        if (manifests.some((manifest) => manifest.tools.some((tool) => tool.name === 'vale'))) {
            notes.push(await installValePackages(context));
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
        return { note: notes.filter(Boolean).join('; '), exitCode: 0, steps };
    } catch (error) {
        if (!(error instanceof GspotError) || (error.code !== 'tool' && error.code !== 'installation')) throw error;
        return {
            note: `${error.message}\nTool installation is incomplete. Run: gspot install`,
            exitCode: EXIT_ERROR,
            steps,
        };
    }
}

import which from 'which';
import { installHooks } from '#cli/apply/hooks.ts';
import { GspotError } from '#cli/system/errors.ts';
import { listStaleFiles } from '#cli/apply/stale.ts';
import { EXIT_ERROR } from '#cli/config/terminal.ts';
import type { Writer } from '#cli/types/ownership.ts';
import type { Session } from '#cli/types/planning.ts';
import { MISE_PROGRAM } from '#cli/config/tools/find.ts';
import { installValePackages } from '#cli/tools/vale.ts';
import { TOOL_PROJECT_INPUTS } from '#cli/config/install.ts';
import { installMiseTools } from '#cli/commands/install/mise.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { installToolProjects } from '#cli/commands/install/projects.ts';
import { verifyPackageManagerVersion } from '#cli/tools/npm/project.ts';
import type { InstallContext, InstallationResult } from '#cli/types/install.ts';
/**
 * Install selected tools in their repository projects and set the clone's hooks.
 *
 * @param session the repository session.
 * @param log the locked repository writer.
 * @param generated the selected tool projects.
 *
 * @param cancelSignal the cancellation signal shared with installation processes.
 * @returns commands run, the installation summary, and exit code.
 */
export async function installTools(
    session: Session,
    log: Writer,
    generated: GenerationResult,
    cancelSignal?: AbortSignal,
): Promise<InstallationResult> {
    const manifests = session.neededToolManifests;
    const steps: (readonly string[])[] = [];
    const notes: string[] = [];
    const tools = listDistinctTools(manifests);
    const mise = which.sync(MISE_PROGRAM, { nothrow: true });
    const context: InstallContext = {
        session,
        writer: log,
        generated,
        tools,
        mise,
        steps,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    };
    try {
        await verifyPackageManagerVersion(context);
        if (listStaleFiles(session, generated).some((file) => TOOL_PROJECT_INPUTS.has(file.path)))
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
        return { note: notes.filter(Boolean).join('\n'), exitCode: 0, steps };
    } catch (error) {
        cancelSignal?.throwIfAborted();
        if (!(error instanceof GspotError) || !['tool', 'installation'].includes(error.code)) throw error;
        return {
            note: `${error.message}\nTool installation is incomplete. Run: gspot install`,
            exitCode: EXIT_ERROR,
            steps,
        };
    }
}

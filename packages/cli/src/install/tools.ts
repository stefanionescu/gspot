import which from 'which';
import { GspotError } from '#cli/system/errors.ts';
import { installHooks } from '#cli/install/hooks.ts';
import type { Session } from '#cli/types/session.ts';
import { MISE_TOOL } from '#cli/config/tools/locate.ts';
import { installMiseTools } from '#cli/install/mise.ts';
import type { Files } from '#cli/types/system/files.ts';
import { installValePackages } from '#cli/install/vale.ts';
import { VALE_TOOL } from '#cli/config/checks/general/prose.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { installToolProjects } from '#cli/install/tool-projects.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { assertPackageManagerVersion } from '#cli/install/npm/project.ts';
import type { ToolInstall, InstallResult } from '#cli/types/install/tools.ts';
import { readToolPackageManager } from '#cli/repository/npm/package-manager.ts';

/**
Install the tools in their tool projects and set the hooks of this clone.

@param session the repository to install for.
@param writer the locked repository handle.
@param generated the tool projects to install.
@returns the commands that ran and the install summary.
*/
export async function installTools(
    session: Session,
    writer: Files,
    generated: GenerationResult,
): Promise<InstallResult> {
    const configurations = session.toolConfigurations;
    const steps: (readonly string[])[] = [];
    const notes: string[] = [];
    const tools = listDistinctTools(configurations);
    const misePath = which.sync(MISE_TOOL, { nothrow: true });
    try {
        const context: ToolInstall = {
            session,
            packageManager:
                session.packageManager === undefined
                    ? undefined
                    : readToolPackageManager(
                          session.installedRoot,
                          session.packageManager,
                          session.timeoutSeconds,
                          session.reads,
                      ),
            writer,
            generated,
            tools,
            misePath,
            steps,
        };
        await assertPackageManagerVersion(context);
        const toolNote = await installMiseTools(context);
        notes.push(...(await installToolProjects(context)));
        if (configurations.some((configuration) => configuration.tools.some((tool) => tool.name === VALE_TOOL))) {
            notes.push(await installValePackages(context));
        }
        notes.push(installHooks(session, steps), toolNote);
        return { note: notes.filter(Boolean).join('\n'), steps };
    } catch (error) {
        session.cancelSignal?.throwIfAborted();
        if (!(error instanceof GspotError) || !['tool', 'install'].includes(error.code)) throw error;
        throw new GspotError('install', error.message, {
            cause: error,
        });
    }
}

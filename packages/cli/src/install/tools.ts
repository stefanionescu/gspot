import which from 'which';
import { GspotError } from '#cli/system/errors.ts';
import { installHooks } from '#cli/install/hooks.ts';
import type { Session } from '#cli/types/session.ts';
import type { Writer } from '#cli/types/ownership.ts';
import { MISE_TOOL } from '#cli/config/tools/locate.ts';
import { installMiseTools } from '#cli/install/mise.ts';
import { installValePackages } from '#cli/install/vale.ts';
import { VALE_TOOL } from '#cli/config/checks/general/prose.ts';
import { installSandboxTools } from '#cli/install/tool-projects.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { listDistinctTools } from '#cli/configurations/declared-tools.ts';
import type { ToolInstall, InstallResult } from '#cli/types/install/tools.ts';
import { assertPackageManagerVersion } from '#cli/install/npm/tool-project.ts';

/**
 * Install the tools in their tool projects and set the hooks of this clone.
 *
 * @param session the repository to install for.
 * @param writer the locked repository handle.
 * @param generated the tool projects to install.
 * @returns the commands that ran and the install summary.
 */
export async function installTools(
    session: Session,
    writer: Writer,
    generated: GenerationResult,
): Promise<InstallResult> {
    const configurations = session.neededToolConfigurations;
    const steps: (readonly string[])[] = [];
    const notes: string[] = [];
    const tools = listDistinctTools(configurations);
    const misePath = which.sync(MISE_TOOL, { nothrow: true });
    const context: ToolInstall = {
        session,
        writer,
        generated,
        tools,
        misePath,
        steps,
    };
    try {
        await assertPackageManagerVersion(context);
        const toolNote = await installMiseTools(context);
        notes.push(...(await installSandboxTools(context)));
        if (configurations.some((configuration) => configuration.tools.some((tool) => tool.name === VALE_TOOL))) {
            notes.push(await installValePackages(context));
        }
        notes.push(installHooks(session, steps), toolNote);
        return { note: notes.filter(Boolean).join('\n'), steps };
    } catch (error) {
        session.cancelSignal?.throwIfAborted();
        if (!(error instanceof GspotError) || !['tool', 'install'].includes(error.code)) throw error;
        throw new GspotError('install', `${error.message}\nTool installation is incomplete. Run gspot install.`, {
            cause: error,
        });
    }
}

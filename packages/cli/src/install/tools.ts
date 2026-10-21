import which from 'which';
import { GspotError } from '#cli/system/errors.ts';
import { installHooks } from '#cli/install/hooks.ts';
import { VALE_TOOL } from '#cli/config/tools/vale.ts';
import type { Writer } from '#cli/types/ownership.ts';
import type { Session } from '#cli/types/planning.ts';
import { installMiseTools } from '#cli/install/mise.ts';
import { MISE_PROGRAM } from '#cli/config/tools/find.ts';
import { installValePackages } from '#cli/install/vale.ts';
import { installToolProjects } from '#cli/install/projects.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { assertPackageManagerVersion } from '#cli/install/npm/project.ts';
import type { InstallContext, InstallationResult } from '#cli/types/install.ts';

/**
 * Install the tools in their tool projects and set the hooks of this clone.
 *
 * @param session the repository to install for.
 * @param writer the locked repository handle.
 * @param generated the tool projects to install.
 * @returns the commands that ran, the install summary, and the exit code.
 */
export async function installTools(
    session: Session,
    writer: Writer,
    generated: GenerationResult,
): Promise<InstallationResult> {
    const manifests = session.neededToolManifests;
    const steps: (readonly string[])[] = [];
    const notes: string[] = [];
    const tools = listDistinctTools(manifests);
    const mise = which.sync(MISE_PROGRAM, { nothrow: true });
    const context: InstallContext = {
        session,
        writer,
        generated,
        tools,
        mise,
        steps,
    };
    try {
        await assertPackageManagerVersion(context);
        const programNote = await installMiseTools(context);
        notes.push(...(await installToolProjects(context)));
        if (manifests.some((manifest) => manifest.tools.some((tool) => tool.name === VALE_TOOL))) {
            notes.push(await installValePackages(context));
        }
        notes.push(installHooks(session, steps), programNote);
        return { note: notes.filter(Boolean).join('\n'), steps };
    } catch (error) {
        session.cancelSignal?.throwIfAborted();
        if (!(error instanceof GspotError) || !['tool', 'installation'].includes(error.code)) throw error;
        throw new GspotError('installation', `${error.message}\nTool installation is incomplete. Run: gspot install`, {
            cause: error,
        });
    }
}

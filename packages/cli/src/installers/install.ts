import which from 'which';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { MISE_TOOL } from '#cli/config/tools/locate.ts';
import { installHooks } from '#cli/installers/hooks.ts';
import type { Files } from '#cli/types/system/files.ts';
import { installMiseTools } from '#cli/installers/mise.ts';
import { installValePackages } from '#cli/installers/vale.ts';
import { installToolProjects } from '#cli/installers/projects.ts';
import { getTable, findRootScope } from '#cli/settings/scopes.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { assertPackageManagerVersion } from '#cli/installers/npm/project.ts';
import { readToolPackageManager } from '#cli/repository/npm/package-manager.ts';
import { listDistinctTools, listToolProjectPins } from '#cli/configurations/tools.ts';
import type { ToolInstall, InstallResult, ToolPackageManager } from '#cli/types/installers/install.ts';

/**
Read the package manager of the tool project, and how a command runs it: with the pin of the repository when the
repository uses the same manager.

@param session the repository and its package manager pin.
@returns the package manager with its command, or undefined when the repository has no npm project.
*/
export function readInstallPackageManager(session: Session): ToolPackageManager | undefined {
    const pin = session.packageManager;
    if (pin === undefined) return undefined;
    const packageManager = readToolPackageManager(session.toolsRoot, pin, session.timeoutSeconds, session.reads);
    return { ...packageManager, command: pin.name === packageManager.name ? pin : { name: packageManager.name } };
}

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
    const pins = listToolProjectPins(configurations);
    const steps: (readonly string[])[] = [];
    const tools = listDistinctTools(configurations);
    const misePath = which.sync(MISE_TOOL, { nothrow: true });
    try {
        const context: ToolInstall = {
            session,
            packageManager: readInstallPackageManager(session),
            minimumReleaseAge: {
                days: getTable(findRootScope(session.scopes).settings, 'dependencies').min_release_age_days,
                npmExclusions: Object.keys(pins.npm),
                pythonExclusions: pins.python.map((pin) => pin.slice(0, pin.indexOf('=='))),
            },
            writer,
            generated,
            tools,
            misePath,
            steps,
        };
        await assertPackageManagerVersion(context);
        const mise = await installMiseTools(context);
        const notes = [
            ...(await installToolProjects(context, mise.binPaths)),
            await installValePackages(context, mise.binPaths),
            installHooks(session, steps),
            mise.note,
        ];
        return { note: notes.filter(Boolean).join('\n'), steps };
    } catch (error) {
        session.cancelSignal?.throwIfAborted();
        if (!(error instanceof GspotError) || error.code !== 'tool') throw error;
        throw new GspotError('install', error.message, {
            cause: error,
        });
    }
}

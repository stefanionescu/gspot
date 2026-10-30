import which from 'which';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { MISE_TOOL } from '#cli/config/tools/locate.ts';
import { installHooks } from '#cli/installers/hooks.ts';
import type { Files } from '#cli/types/system/files.ts';
import { installMiseTools } from '#cli/installers/mise.ts';
import { installValePackages } from '#cli/installers/vale.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { getTable, getRootScope } from '#cli/settings/scopes.ts';
import type { Generation } from '#cli/types/generation/files.ts';
import { installToolProjects } from '#cli/installers/projects.ts';
import { assertPackageManagerVersion } from '#cli/installers/npm/project.ts';
import { readToolPackageManager } from '#cli/repository/npm/package-manager.ts';
import type { ToolInstall, InstallResult, ToolPackageManager } from '#cli/types/installers/install.ts';

function readInstallPackageManager(session: Session): ToolPackageManager | undefined {
    const pin = session.packageManager;
    if (pin === undefined) return undefined;
    const packageManager = readToolPackageManager(session.toolsRoot, pin, session.timeoutSeconds, session.reads);
    return { ...packageManager, command: pin.name === packageManager.name ? pin : { name: packageManager.name } };
}

/**
Install the tools in their tool projects and set the hooks of this clone.

@param session the repository to install for.
@param writer the repository handle.
@param generated the tool projects to install.
*/
export async function installTools(session: Session, writer: Files, generated: Generation): Promise<InstallResult> {
    try {
        const context = buildToolInstall(session, writer, generated);
        const { steps } = context;
        await assertPackageManagerVersion(context);
        const mise = await installMiseTools(context);
        const installed = [
            mise.installed,
            ...(await installToolProjects(context, mise.binPaths)),
            await installValePackages(context, mise.binPaths),
        ];
        const hooks = await installHooks(session, steps);
        if (hooks.command !== undefined) installed.push(hooks.note);
        const notes = [hooks.command === undefined ? hooks.note : '', mise.note];
        return { installed: installed.filter(Boolean), notes: notes.filter(Boolean), steps };
    } catch (error) {
        session.cancelSignal?.throwIfAborted();
        if (!(error instanceof GspotError) || error.code !== 'tool') throw error;
        throw new GspotError('install', error.message, {
            cause: error,
        });
    }
}

/**
Build what every install step reads from the session.

@param session the repository and its settings.
@param writer the files of the run.
@param generated the files that apply wrote.
@returns the install of the tools.
*/
export function buildToolInstall(session: Session, writer: Files, generated: Generation): ToolInstall {
    const configurations = session.toolConfigurations;
    const steps: (readonly string[])[] = [];
    const tools = listDistinctTools(configurations);
    const misePath = which.sync(MISE_TOOL, { nothrow: true });
    return {
        session,
        packageManager: readInstallPackageManager(session),
        releaseAgeDays: getTable(getRootScope(session.scopes).settings, 'dependencies').min_release_age_days,
        writer,
        generated,
        tools,
        misePath,
        steps,
    };
}

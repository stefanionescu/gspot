import { findProgram } from '#cli/system/programs.ts';
import { listDistinctTools } from '#cli/tools/pins.ts';
import { MISE_TOOL } from '#cli/config/tools/installers.ts';
import { installHooks } from '#cli/tools/installers/hooks.ts';
import { getTable, getRootScope } from '#cli/settings/scopes.ts';
import { installMiseTools } from '#cli/tools/installers/mise.ts';
import { installValePackages } from '#cli/tools/installers/vale.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { installToolProjects } from '#cli/tools/installers/projects.ts';
import { writePlans, planReplacements } from '#cli/repository/writer.ts';
import { assertPackageManagerVersion } from '#cli/tools/installers/npm/project.ts';
import { readToolPackageManager } from '#cli/repository/javascript/package-manager.ts';
import type { Session, ToolInstall, InstallResult, ToolPackageManager } from '#cli/types/tools.ts';

function readInstallPackageManager(session: Session): ToolPackageManager | undefined {
    const pin = session.packageManager;
    if (pin === undefined) return undefined;
    const packageManager = readToolPackageManager(session.toolsRoot, pin, session.timeoutSeconds, session.cache);
    return { ...packageManager, command: pin.name === packageManager.name ? pin : { name: packageManager.name } };
}

function writeToolProjects({ writer, generated }: ToolInstall): void {
    const requests = generated.files.map(({ path, content }) => ({
        path,
        next: { bytes: Buffer.from(content), mode: OWNER_WRITABLE_FILE },
        previous: writer.read(path),
    }));
    writePlans(writer, planReplacements(writer, requests));
}

/**
Install the tools in their tool projects and set the hooks of this clone.

@param session the repository to install for.
@param input the repository handle, generated files, and tools of the checks.
*/
export async function installTools(
    session: Session,
    input: Pick<ToolInstall, 'writer' | 'generated' | 'checkTools'>,
): Promise<InstallResult> {
    const context = buildToolInstall(session, input);
    const { steps } = context;
    await assertPackageManagerVersion(context);
    writeToolProjects(context);
    const mise = await installMiseTools(context);
    const installed = [
        mise.installed,
        ...(await installToolProjects(context, mise.binPaths)),
        await installValePackages(context, mise.binPaths),
    ];
    const hooks = await installHooks(session, steps);
    if (hooks.command !== undefined) installed.push(hooks.note);
    const notes = [hooks.command === undefined ? hooks.note : ''];
    const missing = [mise.note];
    return {
        installed: installed.filter(Boolean),
        missing: missing.filter(Boolean),
        notes: notes.filter(Boolean),
        steps,
    };
}

/**
Build what every install step reads from the session.

@param session the repository and its settings.
@param input the repository handle, generated files, and tools of the checks.
@returns the install of the tools.
*/
function buildToolInstall(
    session: Session,
    input: Pick<ToolInstall, 'writer' | 'generated' | 'checkTools'>,
): ToolInstall {
    const configurations = session.toolConfigurations;
    const steps: (readonly string[])[] = [];
    const tools = listDistinctTools(configurations);
    const misePath = findProgram(MISE_TOOL);
    return {
        session,
        packageManager: readInstallPackageManager(session),
        releaseAgeDays: getTable(getRootScope(session.scopes).settings, 'dependencies').min_release_age_days,
        ...input,
        tools,
        misePath,
        steps,
    };
}

import type { Tool } from '#cli/types/manifests.ts';
import { findProgram } from '#cli/system/programs.ts';
import { MISE_TOOL } from '#cli/config/tools/installers.ts';
import { installHooks } from '#cli/tools/installers/hooks.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { getTable, getRootScope } from '#cli/settings/scopes.ts';
import { readPythonSettings } from '#cli/tools/installers/pypi.ts';
import { installGrammars } from '#cli/tools/installers/grammars.ts';
import { installValePackages } from '#cli/tools/installers/vale.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { writePlans, planReplacements } from '#cli/repository/writer.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { assertPackageManagerVersion } from '#cli/tools/installers/npm/project.ts';
import { installMiseTools, reinstallMiseTools } from '#cli/tools/installers/mise.ts';
import { findMisePin, findMissingBuild, listDistinctTools } from '#cli/tools/pins.ts';
import { readToolPackageManager } from '#cli/repository/javascript/package-manager.ts';
import { repairToolProjects, installToolProjects } from '#cli/tools/installers/projects.ts';
import type { Session, BrokenTool, ToolInstall, InstallResult, ToolPackageManager } from '#cli/types/tools.ts';

async function readInstallPackageManager(session: Session): Promise<ToolPackageManager | undefined> {
    const pin = session.packageManager;
    if (pin === undefined) return undefined;
    const packageManager = await readToolPackageManager(
        session.toolsRoot,
        pin,
        session.settings.tool_timeout_seconds,
        session.cache,
    );
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

async function listBrokenTools(install: ToolInstall, tools: Tool[], miseBinPaths: string[]): Promise<BrokenTool[]> {
    const { session } = install;
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const inspected = await Promise.all(
        tools
            .filter((tool) => findMissingBuild(tool, host) === undefined)
            .map(async (tool) => ({
                tool,
                inspection: await inspectTool({ ...session, miseBinPaths, runsVersionCommand: true }, tool),
            })),
    );
    return inspected.filter(({ tool, inspection }) => 'status' in buildToolAvailability(tool, inspection));
}

async function repairTools(install: ToolInstall, tools: Tool[], miseBinPaths: string[]): Promise<string[]> {
    const broken = await listBrokenTools(install, tools, miseBinPaths);
    if (broken.length === 0) return [];
    await repairToolProjects(
        install,
        miseBinPaths,
        broken.map(({ tool }) => tool),
    );
    await reinstallMiseTools(
        install,
        broken.flatMap(({ tool }) => findMisePin(tool) ?? []),
    );
    const failed = await listBrokenTools(install, tools, miseBinPaths);
    return failed.map(({ tool, inspection }) => {
        const reason = inspection.note ?? `gspot found ${inspection.found ?? 'no program'}`;
        return `${tool.name} ${tool.version ?? ''} still fails after a forced install. ${reason}`;
    });
}

/**
Install the tools in their tool projects, inspect each one, reinstall the ones that fail, and set the hooks of this
clone.

@param session the repository to install for.
@param input the repository handle, generated files, and tools of the checks.
*/
export async function installTools(
    session: Session,
    input: Pick<ToolInstall, 'writer' | 'generated' | 'checkTools'>,
): Promise<InstallResult> {
    const context = await buildToolInstall(session, input);
    const { steps } = context;
    await assertPackageManagerVersion(context);
    writeToolProjects(context);
    const mise = await installMiseTools(context);
    const projects = await installToolProjects(context, mise.binPaths);
    const installed = [
        mise.installed,
        ...projects.installed,
        await installValePackages(context, mise.binPaths),
        await installGrammars(context),
    ];
    const broken = await repairTools(context, [...mise.tools, ...projects.tools], mise.binPaths);
    const hooks = await installHooks(session, steps);
    if (hooks.command !== undefined) installed.push(hooks.note);
    const notes = [hooks.command === undefined ? hooks.note : ''];
    const missing = [mise.note, ...broken];
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
*/
async function buildToolInstall(
    session: Session,
    input: Pick<ToolInstall, 'writer' | 'generated' | 'checkTools'>,
): Promise<ToolInstall> {
    const configurations = session.toolConfigurations;
    const steps: Array<readonly string[]> = [];
    const tools = listDistinctTools(configurations);
    const misePath = findProgram(MISE_TOOL);
    return {
        session,
        packageManager: await readInstallPackageManager(session),
        pythonSettings: readPythonSettings(session.root),
        releaseAgeDays: getTable(getRootScope(session.scopes).settings, 'dependencies').min_release_age_days,
        ...input,
        tools,
        misePath,
        steps,
    };
}

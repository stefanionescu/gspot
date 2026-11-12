import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { MISE_TOOL } from '#cli/config/tools/installers.ts';
import { listDistinctTools } from '#cli/manifests/read.ts';
import { readToolPackageManager } from '#cli/repository/package-manager.ts';
import { planReplacements, writePlans } from '#cli/repository/writer.ts';
import { getRootScope, getTable } from '#cli/settings/scopes.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { findProgram } from '#cli/system/programs.ts';
import { buildToolAvailability, inspectTool, lookUpTool } from '#cli/tools/inspect.ts';
import { installGrammars } from '#cli/tools/installers/grammars.ts';
import { installHooks, readHookStatus } from '#cli/tools/installers/hooks.ts';
import { installMiseTools, reinstallMiseTools } from '#cli/tools/installers/mise.ts';
import { assertPackageManagerVersion } from '#cli/tools/installers/npm/project.ts';
import {
    installNpmToolProject,
    installPythonToolProjects,
    isEveryEnvironmentReady,
    listStaleLockfiles,
    repairToolProjects,
} from '#cli/tools/installers/projects.ts';
import { readPythonSettings } from '#cli/tools/installers/pypi.ts';
import { installValePackages } from '#cli/tools/installers/vale.ts';
import { readToolBinPaths } from '#cli/tools/locate.ts';
import { buildToolProjects, findMisePin, findMissingBuild, findPackagePin } from '#cli/tools/pins.ts';
import type { Tool } from '#cli/types/manifests.ts';
import type { BrokenTool, InstallResult, Session, ToolInstall, ToolPackageManager } from '#cli/types/tools.ts';

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

async function isEveryToolInstalled(install: ToolInstall): Promise<boolean> {
    const { session, generated, writer, checkTools } = install;
    const isWritten = generated.files.every(
        ({ path, content }) => writer.read(path)?.bytes.toString('utf8') === content,
    );
    const hooks = await readHookStatus(session, session.repository);
    if (!isWritten || !hooks.ready || listStaleLockfiles(session, generated.files).length > 0) return false;
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const search = { ...session, runsVersionCommand: true };
    const availabilities = await Promise.all(
        install.tools
            .filter(
                (tool) =>
                    findMissingBuild(tool, host) === undefined &&
                    (findPackagePin(tool) !== undefined ||
                        (findMisePin(tool) !== undefined && checkTools.has(tool.name))),
            )
            .map(async (tool) => buildToolAvailability(tool, await lookUpTool(search, tool, session.root))),
    );
    if (availabilities.some((availability) => 'status' in availability)) return false;
    const { folders } = await readToolBinPaths(session);
    return isEveryEnvironmentReady(install, folders);
}

export async function buildToolInstall(
    session: Session,
    input: Pick<ToolInstall, 'writer' | 'checkTools' | 'misePath' | 'runsProjectInstall'>,
): Promise<ToolInstall> {
    const configurations = session.toolConfigurations;
    const steps: Array<readonly string[]> = [];
    const tools = listDistinctTools(configurations);
    return {
        session,
        packageManager: await readInstallPackageManager(session),
        pythonSettings: readPythonSettings(session.root),
        releaseAgeDays: getTable(getRootScope(session.scopes).settings, 'dependencies').min_release_age_days,
        ...input,
        generated: { files: buildToolProjects(session) },
        tools,
        steps,
    };
}

/**
Install the tools in their tool projects, inspect each one, reinstall the ones that fail, and set the hooks of this
clone. When every tool already passes, install only adds the Vale packages and grammars that are missing.
*/
export async function installTools(
    session: Session,
    input: Pick<ToolInstall, 'writer' | 'checkTools' | 'runsProjectInstall'>,
): Promise<InstallResult> {
    const context = await buildToolInstall(session, { ...input, misePath: findProgram(MISE_TOOL) });
    const { steps } = context;
    await assertPackageManagerVersion(context);
    if (await isEveryToolInstalled(context)) {
        const { folders } = await readToolBinPaths(session);
        const added = [await installValePackages(context, folders), await installGrammars(context)];
        return { installed: added.filter(Boolean), missing: [], notes: [], steps };
    }
    writeToolProjects(context);
    // Both steps run to the end before a failure stops the install, so no package manager writes after it.
    const [miseRun, npmRun] = await Promise.allSettled([installMiseTools(context), installNpmToolProject(context)]);
    if (miseRun.status === 'rejected') throw miseRun.reason;
    if (npmRun.status === 'rejected') throw npmRun.reason;
    const mise = miseRun.value;
    const python = await installPythonToolProjects(context, mise.binPaths);
    const installed = [
        mise.installed,
        ...npmRun.value.installed,
        ...python.installed,
        await installValePackages(context, mise.binPaths),
        await installGrammars(context),
    ];
    const tools = [...mise.tools, ...npmRun.value.tools, ...python.tools];
    const broken = await repairTools(context, tools, mise.binPaths);
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

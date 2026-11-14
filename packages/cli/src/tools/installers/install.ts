import { getTable } from '#cli/settings/tables.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { readHost } from '#cli/system/environment.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { getRootScope } from '#cli/settings/scopes.ts';
import { buildToolProjects } from '#cli/tools/projects.ts';
import { listDistinctTools } from '#cli/manifests/tools.ts';
import { readToolBinPaths } from '#cli/tools/programs/mise.ts';
import { findProgram } from '#cli/system/processes/programs.ts';
import { installGrammars } from '#cli/tools/installers/grammars.ts';
import { installValePackages } from '#cli/tools/installers/vale.ts';
import { MISE_PROGRAM, OWNER_WRITABLE_FILE } from '#cli/config/system.ts';
import { readPythonSettings } from '#cli/tools/installers/python/indexes.ts';
import { installHooks, readHookStatus } from '#cli/tools/installers/hooks.ts';
import { writePlans, planReplacements } from '#cli/repository/files/writes.ts';
import { findMisePin, findPackagePin, findMissingBuild } from '#cli/tools/pins.ts';
import { installMiseTools, reinstallMiseTools } from '#cli/tools/installers/mise.ts';
import type { Session, BrokenTool, ToolInstall, InstallResult } from '#cli/types/tools.ts';
import { lookUpTool, inspectTool, buildToolAvailability } from '#cli/tools/programs/inspect.ts';
import { readToolPackageManager, assertPackageManagerVersion } from '#cli/tools/installers/npm/package-manager.ts';

import {
    repairToolProjects,
    isEveryLockfileFresh,
    installNpmToolProject,
    isEveryEnvironmentReady,
    installPythonToolProjects,
} from '#cli/tools/installers/projects.ts';

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
    const host = readHost();
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
    if (!isWritten || !hooks.ready || !(await isEveryLockfileFresh(install))) return false;
    const host = readHost();
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
    input: Pick<ToolInstall, 'checkTools' | 'misePath' | 'runsProjectInstall'>,
): Promise<ToolInstall> {
    const configurations = session.toolConfigurations;
    const steps: Array<readonly string[]> = [];
    const tools = listDistinctTools(configurations);
    return {
        session,
        packageManager: await readToolPackageManager(session),
        pythonSettings: readPythonSettings(session.root),
        releaseAgeDays: getTable(getRootScope(session.scopes).settings, 'dependencies').min_release_age_days,
        ...input,
        writer: openFiles(session.root),
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
    input: Pick<ToolInstall, 'checkTools' | 'runsProjectInstall'>,
): Promise<InstallResult> {
    const context = await buildToolInstall(session, { ...input, misePath: findProgram(MISE_PROGRAM) });
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

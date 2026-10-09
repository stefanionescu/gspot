import { join, relative } from 'node:path';
import { compact } from '#cli/platform/contracts.ts';
import { misePins } from '#cli/configurations/public.ts';
import { parseMiseToolKeys } from '#cli/parsers/mise.ts';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { MISE_BACKENDS } from '#cli/config/configurations.ts';
import { packageToolProject } from '#cli/tools/npm/public.ts';
import { TOOL_PROJECT_FILES } from '#cli/config/tools/mise.ts';
import type { ToolProject } from '#cli/types/tools/project.ts';
import { pythonToolProject } from '#cli/tools/python/public.ts';
import { openRoot, readText } from '#cli/platform/root/public.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { PythonPreparation } from '#cli/types/tools/python.ts';
import { installedPackage, installedDependency } from '#cli/repository/contracts.ts';
import { misePin, collectPins, toolProjectPackage } from '#cli/configurations/contracts.ts';
import { DOT_GSPOT, YARN_SETTINGS, MISE_CONFIG_PATH, NODE_MODULES_DIRECTORY } from '#cli/config/platform/locations.ts';

import {
    installHint,
    readToolVersion,
    unavailableNote,
    locateCandidates,
    toolVersionState,
    prepareToolProject,
    locateRepositoryCandidates,
} from '#cli/tools/contracts.ts';
import type {
    Inspected,
    ToolOwner,
    ToolSearch,
    LockfileDrift,
    ToolInspection,
    DuplicateMisePin,
    ToolAvailability,
    LockfilePreparation,
    AvailableToolInspection,
} from '#cli/types/tools/install.ts';

// The inspection of a library whose tool-project package.json declares a version.
function libraryInspection(root: string, tool: ToolPin, path: string, found: string, hint: string): ToolInspection {
    const want = tool.version === undefined ? {} : { want: tool.version };
    const floor = tool.min_version ?? tool.version ?? found;
    let state = tool.version === undefined ? 'ok' : toolVersionState(found, tool.version, floor);
    if (tool.system === true) state = toolVersionState(found, undefined, floor);
    return {
        name: tool.name,
        state,
        path: tool.system === true ? path : join(root, path),
        found,
        hint,
        floor,
        ...want,
    };
}

// Query a host library through the declared native executable and its complete argument list.
function inspectLibraryCommand(context: ToolSearch, cwd: string, tool: ToolPin, command: string[]): ToolInspection {
    const hint = installHint(tool);
    const [program, ...args] = command;
    if (program === undefined)
        return { name: tool.name, state: 'error', hint, note: `${tool.name} has no host version command.` };
    const [path] = locateCandidates(context.root, program, {
        searchFolders: [cwd, context.root],
        installedRoot: context.installedRoot,
    });
    const root = context.installedRoot ?? context.root;
    return path === undefined
        ? missingInspection(tool, hint)
        : executableInspection({
              root,
              cwd: join(root, relative(context.root, cwd)),
              tool: { ...tool, version_command: args },
              path,
              hint,
          });
}

// Read a host library from its project's package resolution, or use its declared full native query.
function inspectHostLibrary(context: ToolSearch, cwd: string, tool: ToolPin): ToolInspection {
    if (tool.version_command !== undefined) return inspectLibraryCommand(context, cwd, tool, tool.version_command);
    const root = context.installedRoot ?? context.root;
    const hint = installHint(tool);
    const name = tool.installers['npm']?.name ?? tool.name;
    const dependency = installedDependency(root, join(relative(context.root, cwd), 'package.json'), name);
    return dependency?.version === undefined
        ? missingInspection(tool, hint)
        : libraryInspection(root, tool, dependency.path, dependency.version, hint);
}

// Read library versions from the tool project installation used by generated configurations.
function inspectLibrary(context: ToolSearch, cwd: string, tool: ToolPin): ToolInspection {
    if (tool.system === true) return inspectHostLibrary(context, cwd, tool);
    const root = context.installedRoot ?? context.root;
    const hint = installHint(tool);
    using files = openRoot(root);
    const name = tool.installers['npm']?.name ?? tool.name;
    const path = `${NODE_MODULES_DIRECTORY}/${name}/package.json`;
    const parsed = installedPackage(files, root, join(root, path));
    if (parsed?.version === undefined) return missingInspection(tool, hint);
    return libraryInspection(root, tool, path, parsed.version, hint);
}

// The inspection of a tool that is not installed anywhere gspot looks.

function missingInspection(tool: ToolPin, hint: string): ToolInspection {
    const want = tool.version === undefined ? {} : { want: tool.version };
    return { name: tool.name, state: 'missing', hint, ...want };
}

// Query an executable once and assemble its native host or selected-version inspection.
function executableInspection(
    inspected: Inspected,
    want = inspected.tool.system === true ? undefined : inspected.tool.version,
): ToolInspection {
    const { root, cwd, tool, path, hint } = inspected;
    if (want === undefined && tool.version_command === undefined) return { name: tool.name, state: 'host', path, hint };
    const read = readToolVersion(root, cwd, path, tool);
    const expected = compact({ want });
    if ('state' in read) return { name: tool.name, path, hint, ...expected, ...read };
    const floor = tool.min_version ?? want;
    const state = toolVersionState(read.version, want, floor);
    return { name: tool.name, state, path, hint, found: read.version, ...expected, ...compact({ floor }) };
}

// Project compilers keep their native ownership; a declared tool-project package supplies the compiler when absent.
function inspectProjectExecutable(
    context: ToolSearch,
    cwd: string,
    tool: ToolPin,
    runner?: string,
): ToolInspection | undefined {
    if (tool.system !== true) return undefined;
    const installation = toolProjectPackage(tool, runner);
    if (installation === undefined) return undefined;
    const { root } = context;
    const hint = installHint(tool, runner);
    const [project] = locateRepositoryCandidates(root, tool.name, {
        searchFolders: [cwd, root].flatMap((folder) =>
            context.installedRoot === undefined
                ? [folder]
                : [folder, join(context.installedRoot, relative(root, folder))],
        ),
        installedRoot: context.installedRoot,
    });
    if (project !== undefined) return executableInspection({ root, cwd, tool, path: project, hint });
    if (isInstallationPending(context, tool, runner)) return pendingInspection(tool);
    const [toolProjectPath] = locateCandidates(root, tool.name, {
        searchFolders: [cwd, root],
        toolProjectKind: installation.kind,
        installedRoot: context.installedRoot,
    });
    if (toolProjectPath !== undefined)
        return executableInspection(
            { root, cwd, tool, path: toolProjectPath, hint },
            tool.version ?? installation.version,
        );
    return undefined;
}

function inspectExecutable(context: ToolSearch, cwd: string, tool: ToolPin, runner?: string): ToolInspection {
    const project = inspectProjectExecutable(context, cwd, tool, runner);
    if (project !== undefined) return project;
    const { root } = context;
    const isExternal = tool.system === true || (runner === 'mise' && tool.installers['mise'] !== undefined);
    const searchFolders = isExternal ? [cwd, root] : [join(root, DOT_GSPOT), cwd, root];
    const installation = toolProjectPackage(tool, runner);
    const kind = installation?.kind;
    const hint = installHint(tool, runner);
    const [path] = locateCandidates(root, tool.name, {
        searchFolders,
        toolProjectKind: tool.system === true ? undefined : kind,
        installedRoot: context.installedRoot,
    });
    if (path === undefined) return missingInspection(tool, hint);
    const inspected: Inspected = { root, cwd, tool, path, hint };
    return executableInspection(inspected);
}

// Only the selected tool project installation can make its tool unavailable while installation is pending.
function isInstallationPending(
    search: Pick<ToolSearch, 'root' | 'installedRoot' | 'getPendingInstallations'>,
    tool: ToolPin,
    runner?: string,
): boolean {
    const installation = toolProjectPackage(tool, runner);
    const pending = search.getPendingInstallations?.(search.installedRoot ?? search.root);
    return installation !== undefined && pending?.includes(installation.kind) === true;
}

// Incomplete tool project installations block their tools, including a compiler selected after project lookup.
function pendingInspection(tool: ToolPin): ToolInspection {
    return {
        name: tool.name,
        state: 'error',
        hint: 'Run: gspot install',
        note: 'Tool installation is incomplete. Run: gspot install',
    };
}

function lockfileDrift<Parsed, Preparation, Installation>(
    root: string,
    description: ToolProject<Parsed, Preparation, Installation>,
    generated: GeneratedFile[],
): LockfileDrift | undefined {
    const manifest = generated.find((file) => file.path === description.manifestPath);
    if (manifest === undefined) return undefined;
    const project = description.parse(manifest.content);
    const path = description.lockfilePath(project);
    using files = openRoot(root);
    const recorded = files.read(path);
    if (recorded === undefined) return { path, kind: 'missing' };
    return description.matches(project, recorded.bytes.toString('utf8')) ? { path } : { path, kind: 'changed' };
}

// Preparation may replace a lockfile already present in the command's generated outputs.
function recordLockfile(files: GeneratedFile[], lockfile: GeneratedFile): void {
    const index = files.findIndex((file) => file.path === lockfile.path);
    if (index === -1) files.push(lockfile);
    else files[index] = lockfile;
}

/**
 * Inspect one tool, reusing an inspection already made in this command session.
 * @param context the repository root and session reads
 * @param tool the pin
 * @returns where the tool is, its version, and its state
 */
export function inspectTool(context: ToolSearch, tool: ToolPin): ToolInspection {
    const { root, inspections } = context;
    const runner = context.policyFiles?.policy.runner;
    const pending = isInstallationPending(context, tool, runner);
    if (tool.system !== true && pending) return pendingInspection(tool);
    const cwd = context.cwd ?? root;
    const key = JSON.stringify([root, cwd, tool, runner, pending]);
    const cached = inspections.get(key);
    if (cached) return cached;
    const inspection =
        tool.kind === 'library' ? inspectLibrary(context, cwd, tool) : inspectExecutable(context, cwd, tool, runner);
    inspections.set(key, inspection);
    return inspection;
}

/**
 * Whether the inspected tool can run at a supported version.
 * @param inspection the executable inspection
 * @returns whether a resolved, usable executable is available
 */
export function isToolAvailable(inspection: ToolInspection): inspection is AvailableToolInspection {
    return ['ok', 'host', 'newer'].includes(inspection.state) && inspection.path !== undefined;
}

/**
 * Resolve a usable executable or an actionable inspection failure.
 * @param tool the selected pin
 * @param inspection the resolved path, version, and install command
 * @returns the executable path or its unavailable status and diagnostic
 */
export function toolAvailability(tool: ToolPin, inspection: ToolInspection): ToolAvailability {
    if (isToolAvailable(inspection)) return { path: inspection.path };
    if (inspection.state === 'error')
        return { status: 'error', note: inspection.note ?? `${tool.name} version inspection failed.` };
    return { status: 'missing', note: unavailableNote(tool, inspection) };
}

/**
 * Tools the repository's own mise.toml pins that gspot also pins.
 * @param root the repository root.
 * @param manifests the manifests containing applicable tool requirements.
 * @param runner the selected task runner.
 * @returns each duplicate and the generated file holding the gspot pin.
 */
export function duplicateMisePins(root: string, manifests: Manifest[], runner: string | undefined): DuplicateMisePin[] {
    const source = readText(root, 'mise.toml');
    const keys = source === undefined ? new Set<string>() : parseMiseToolKeys(source);
    const tools = collectPins(manifests);
    const aliases = new Map(
        tools.map((tool) => [
            tool.name,
            [
                tool.name,
                ...MISE_BACKENDS.flatMap((backend) => {
                    const pin = tool.installers[backend.installer];
                    return pin === undefined ? [] : [pin.name, `${backend.prefix}${pin.name}`];
                }),
            ],
        ]),
    );
    const found: DuplicateMisePin[] = tools.flatMap((tool) => {
        const pin = toolProjectPackage(tool, runner);
        return pin === undefined
            ? []
            : [{ tool: tool.name, version: pin.version, gspotFile: TOOL_PROJECT_FILES[pin.kind] }];
    });
    if (runner === 'mise') {
        const names = new Map(
            tools.flatMap((tool) => {
                const pin = misePin(tool);
                return pin === undefined ? [] : [[pin.name, tool.name]];
            }),
        );
        found.push(
            ...misePins(manifests).map((pin) => ({
                tool: names.get(pin.name) ?? pin.name,
                version: pin.version,
                gspotFile: MISE_CONFIG_PATH,
            })),
        );
    }
    return found.filter((pin) => (aliases.get(pin.tool) ?? [pin.tool]).some((name) => keys.has(name)));
}

/**
 * Read lockfile drift for generated tool projects without resolving or writing.
 * @param root the repository root.
 * @param generated the proposed project manifests.
 * @returns missing, mismatched, or current lockfiles.
 */
export function toolProjectDrift(root: string, generated: GeneratedFile[]): LockfileDrift[] {
    return [
        lockfileDrift(root, packageToolProject, generated),
        lockfileDrift(root, pythonToolProject, generated),
    ].filter((drift) => drift !== undefined);
}

/**
 * Append the selected npm and Python projects' lockfiles before publishing configuration.
 * @param preparation the root and command-owned Python installer.
 * @param files the generated outputs.
 * @param owner the repository reader.
 * @param options the lockfile preparation request.
 */
export async function prepareToolProjects(
    preparation: PythonPreparation,
    files: GeneratedFile[],
    owner: Pick<ToolOwner, 'read'>,
    options: LockfilePreparation,
): Promise<void> {
    const packages = files.find((file) => file.path === packageToolProject.manifestPath);
    const python = files.find((file) => file.path === pythonToolProject.manifestPath);
    if (packages !== undefined)
        recordLockfile(
            files,
            await prepareToolProject(packageToolProject, packages, owner, options, {
                root: preparation.root,
                yarn: files.find((file) => file.path === YARN_SETTINGS)?.content,
            }),
        );
    if (python !== undefined)
        recordLockfile(files, await prepareToolProject(pythonToolProject, python, owner, options, preparation));
}

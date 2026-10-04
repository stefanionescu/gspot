import { toolPin } from '#cli/tools/pins.ts';
import { readPolicy } from '#cli/policy/read.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import { join, dirname, delimiter } from 'node:path';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import type { ToolInspection } from '#cli/types/tools/install.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { privateToolInstallation } from '#cli/tools/installation.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { SandboxInstallation } from '#tests/types/harness/install.ts';
import { testModules, installedModules, sourceLauncherDirectory } from '#tests/harness/environment.ts';

function inspectionFailure(name: string, found: ToolInspection): string {
    const fields = { path: found.path, found: found.found, expected: found.want, hint: found.hint, note: found.note };
    const present = Object.entries(fields).filter(([, value]) => value !== undefined);
    const diagnostics = present.map(([label, value]) => `${label}: ${String(value)}`);
    return `Required tool ${name} is ${found.state}. ${diagnostics.join('; ')}`;
}

/**
 * Remove optional fixture configurations through the public mutation and installation pipeline.
 * @param cwd the initialized fixture repository.
 * @param configurations the configurations the fixture removes.
 * @param environment the fixture's isolated environment.
 * @returns the number of removed configurations, whose commands also install applicable tools.
 */
export async function removeConfigurations(
    cwd: string,
    configurations: string[],
    environment: Record<string, string>,
): Promise<number> {
    const selected = new Set(readPolicy(cwd).policy.configurations);
    const chosen = configurations.filter((name) => selected.has(name));
    for (const configuration of chosen) {
        const removed = await spawnGspot(cwd, ['remove', configuration], environment);
        if (removed.code !== 0)
            throw new Error(
                `Test repository removal of ${configuration} failed with status ${String(removed.code)}: ${removed.stderr}${removed.stdout}`,
            );
    }
    return chosen.length;
}

/**
 * A PATH for native and host tools; each sandbox installs its private tool projects.
 * @param names the tool names as mise knows them (`taplo`, `npm:v8r`).
 * @returns the PATH value.
 */
export function buildToolsPath(names: string[]): string {
    const manifests = [...configurationManifests().values()];
    const context = { root, inspections: new Map(), policyFiles: readPolicy(root) };
    const folders = names.flatMap((name) => {
        const tool = toolPin(manifests, name.replace(/^[a-z]+:/u, ''));
        if (privateToolInstallation(tool, context.policyFiles.policy.run_with) !== undefined) return [];
        // A pin without a build for this machine is skipped by the checks that need it, so no PATH entry is owed.
        if (!hasToolBuild(tool.name)) return [];
        const found = inspectTool(context, tool);
        if (found.path === undefined || !['ok', 'host', 'newer'].includes(found.state))
            throw new Error(inspectionFailure(name, found));
        return [dirname(found.path)];
    });
    return [...folders, join(root, 'node_modules', '.bin'), environmentVariables()['PATH'] ?? ''].join(delimiter);
}

/**
 * Build the complete sandbox PATH with the source launcher and test package bins first.
 * @param names the pinned native tools required by the scenario.
 * @returns the sandbox PATH.
 */
export function buildSandboxPath(names: string[]): string {
    const bins = [testModules, installedModules].map((folder) => join(folder, '.bin'));
    const tools = buildToolsPath(names);
    return [sourceLauncherDirectory, ...bins, tools].join(delimiter);
}

/**
 * Run gspot init. Remove the named configurations and install the private tools.
 * @param cwd the test repository, with one commit.
 * @param argv the init command line.
 * @param environment verbatim variables, such as the PATH of the tools.
 * @param settings the configurations to omit and the level to select before installing tools.
 */
export async function install(
    cwd: string,
    argv: string[],
    environment: Record<string, string>,
    settings: SandboxInstallation = {},
): Promise<void> {
    const outcome = await spawnGspot(cwd, argv, environment);
    if (outcome.code !== 0)
        throw new Error(
            `Test repository init failed with status ${String(outcome.code)}: ${outcome.stderr}${outcome.stdout}`,
        );
    if (!(await Bun.file(join(cwd, 'gspot.toml')).exists()))
        throw new Error(`The init command wrote no policy in the test repository: ${outcome.stderr}${outcome.stdout}`);
    const { without = [], level } = settings;
    if (level !== undefined) {
        const selected = await spawnGspot(cwd, ['set', 'level', level], environment);
        if (selected.code !== 0)
            throw new Error(`The ${level} level was not selected: ${selected.stdout}${selected.stderr}`);
    }
    const removed = await removeConfigurations(cwd, without, environment);
    if (removed === 0) await installPrivateTools(cwd);
}

/** Install generated, locked tool projects through the public command. */
export async function installPrivateTools(cwd: string): Promise<void> {
    const outcome = await spawnGspot(cwd, ['install']);
    if (outcome.code !== 0)
        throw new Error(
            `Test repository installation failed with status ${String(outcome.code)}: ${outcome.stderr}${outcome.stdout}`,
        );
}

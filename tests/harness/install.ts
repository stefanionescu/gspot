import { join, delimiter } from 'node:path';
import { readPolicy } from '#cli/policy/read.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { createInstallationRegistry } from '#tests/harness/registry.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { toolPin, toolProjectPackage } from '#cli/configurations/pins.ts';
import type { SandboxInstallation } from '#tests/types/harness/install.ts';
import { testModules, installedModules, sourceLauncherDirectory } from '#tests/harness/environment.ts';

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
 * A PATH for pinned mise tools and workspace commands; sandboxes own their tool projects.
 * @param names the tool names as mise knows them (`taplo`, `npm:v8r`).
 * @returns the PATH value.
 */
export function buildToolsPath(names: string[]): string {
    const manifests = [...configurationManifests().values()];
    const bins = [testModules, installedModules].map((folder) => join(folder, '.bin'));
    const path = [...bins, environmentVariables()['PATH'] ?? ''].join(delimiter);
    for (const name of names) {
        const tool = toolPin(manifests, name.replace(/^[a-z]+:/u, ''));
        if (tool.system === true || toolProjectPackage(tool, 'mise') !== undefined) continue;
        // A pin without a build for this machine is skipped by the checks that need it, so no PATH entry is owed.
        if (!hasToolBuild(tool.name)) continue;
        if (Bun.which(tool.name, { PATH: path }) === null)
            throw new Error(`Required test tool ${name} is unavailable. Run mise run test:tools.`);
    }
    return path;
}

/**
 * Build the complete sandbox PATH with the source launcher and test package bins first.
 * @param names the pinned native tools required by the scenario.
 * @returns the sandbox PATH.
 */
export function buildSandboxPath(names: string[]): string {
    const tools = buildToolsPath(names);
    return [sourceLauncherDirectory, tools].join(delimiter);
}

/**
 * Run gspot init. Remove the named configurations and install the tool projects.
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
    const outcome = await spawnGspot(cwd, [...argv, '--no-install'], environment);
    if (outcome.code !== 0)
        throw new Error(
            `Test repository init failed with status ${String(outcome.code)}: ${outcome.stderr}${outcome.stdout}`,
        );
    await using registry = await createInstallationRegistry(cwd, runTestCommand);
    const installationEnvironment = { ...environment, ...registry.environment };
    const { without = [], level } = settings;
    if (level !== undefined) {
        const selected = await spawnGspot(cwd, ['set', 'level', level], installationEnvironment);
        if (selected.code !== 0)
            throw new Error(`The ${level} level was not selected: ${selected.stdout}${selected.stderr}`);
    }
    const removed = await removeConfigurations(cwd, without, installationEnvironment);
    if (removed === 0) {
        const installed = await spawnGspot(cwd, ['install'], installationEnvironment);
        if (installed.code !== 0)
            throw new Error(`Test repository installation failed: ${installed.stdout}${installed.stderr}`);
    }
}

/** Install generated, locked tool projects through the public command. */
export async function installToolProjects(cwd: string): Promise<void> {
    await using registry = await createInstallationRegistry(cwd, runTestCommand);
    const outcome = await spawnGspot(cwd, ['install'], registry.environment);
    if (outcome.code !== 0)
        throw new Error(
            `Test repository installation failed with status ${String(outcome.code)}: ${outcome.stderr}${outcome.stdout}`,
        );
}

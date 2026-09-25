import { fileURLToPath } from 'node:url';
import { run } from '#tests/support/cli/command.ts';
import { delimiter, dirname, join } from 'node:path';
import { readPolicy } from '#cli/policy/read-policy.ts';
import { probeTool, toolPin } from '#cli/tools/probe.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { privateToolInstallation } from '#cli/tools/installation.ts';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

/**
 * A PATH for native and host tools; each sandbox installs its private tool projects.
 * @param names the tool names as mise knows them (`taplo`, `npm:v8r`)
 * @returns the PATH value
 */
export function toolsPath(names: string[]): string {
    const manifests = [...configurationManifests().values()];
    const context = { root, probes: new Map(), policyFiles: readPolicy(root) };
    const folders = names.flatMap((name) => {
        const tool = toolPin(manifests, name.replace(/^[a-z]+:/u, ''));
        if (tool === undefined) throw new Error(`Required tool ${name} has no configuration-owned definition.`);
        if (privateToolInstallation(tool, context.policyFiles.policy.runner?.tool) !== undefined) return [];
        const found = probeTool(context, tool);
        if (found.path === undefined || !['ok', 'host'].includes(found.state))
            throw new Error(`Required tool ${name} is ${found.state}. ${found.hint} ${found.note ?? ''}`);
        return [dirname(found.path)];
    });
    return [...folders, join(root, 'node_modules', '.bin'), environmentVariables()['PATH'] ?? ''].join(delimiter);
}

/**
 * Runs gspot init and requires successful completion and a written policy.
 * @param cwd the planted repository, with one commit
 * @param argv the init command line
 * @param environment extra variables, such as the PATH of the tools
 */
export async function install(cwd: string, argv: string[], environment: Record<string, string> = {}): Promise<void> {
    const outcome = await run(cwd, argv, environment);
    if (outcome.code !== 0)
        throw new Error(`Sandbox init failed with status ${String(outcome.code)}: ${outcome.stderr}${outcome.stdout}`);
    if (await Bun.file(join(cwd, 'gspot.toml')).exists()) {
        await installPrivateTools(cwd);
        return;
    }
    throw new Error(`The init command wrote no policy in the planted repository: ${outcome.stderr}${outcome.stdout}`);
}

/** Install generated, locked tool projects through the public command. */
export async function installPrivateTools(cwd: string): Promise<void> {
    const outcome = await run(cwd, ['install']);
    if (outcome.code !== 0)
        throw new Error(
            `Sandbox installation failed with status ${String(outcome.code)}: ${outcome.stderr}${outcome.stdout}`,
        );
}

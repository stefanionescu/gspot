import { fileURLToPath } from 'node:url';
import { readPolicy } from '#cli/policy/read.ts';
import * as processes from '#cli/platform/spawn.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { join, dirname, delimiter } from 'node:path';
import { kitManifests } from '#cli/kits/manifests.ts';
import { openSession } from '#cli/execution/session.ts';
import { run, gspot } from '#tests/harness/cli/command.ts';
import { privateToolInstallation } from '#cli/tools/pins.ts';
import { toolPin, inspectTool } from '#cli/tools/inspect.ts';
import { toolShipsHere } from '#tests/harness/cli/platforms.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import { INSTALL_TIMEOUT_MS } from '#tests/inputs/integration/tools/tools.ts';
import { installPythonProject, preparePythonProject } from '#cli/tools/python.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

// Leaves kits out of the root selection init wrote, keeping the layout of the list, and applies the policy again.
export async function leaveOut(cwd: string, kits: string[], environment: Record<string, string>): Promise<void> {
    const path = join(cwd, 'gspot.toml');
    const text = await Bun.file(path).text();
    const [list] = /^kits = \[[^\]]*\]/mu.exec(text) ?? [];
    if (list === undefined) throw new Error('The planted policy names no root kits.');
    let kept = list;
    for (const kit of kits)
        kept = kept.replace(new RegExp(String.raw`\n\s*"${kit}",|"${kit}", |, "${kit}"|"${kit}"`, 'u'), '');
    await Bun.write(
        path,
        text.replace(list, () => kept),
    );
    const applied = await run(cwd, ['apply'], environment);
    if (applied.code !== 0)
        throw new Error(`Sandbox apply failed with status ${String(applied.code)}: ${applied.stderr}${applied.stdout}`);
}

/**
 * A PATH for native and host tools; each sandbox installs its private tool projects.
 * @param names the tool names as mise knows them (`taplo`, `npm:v8r`)
 * @returns the PATH value
 */
export function toolsPath(names: string[]): string {
    const manifests = [...kitManifests().values()];
    const context = { root, inspections: new Map(), policyFiles: readPolicy(root) };
    const folders = names.flatMap((name) => {
        const tool = toolPin(manifests, name.replace(/^[a-z]+:/u, ''));
        if (privateToolInstallation(tool, context.policyFiles.policy.runner?.tool) !== undefined) return [];
        // A pin without a build for this machine is skipped by the checks that need it, so no PATH entry is owed.
        if (!toolShipsHere(tool.name)) return [];
        const found = inspectTool(context, tool);
        if (found.path === undefined || !['ok', 'host'].includes(found.state))
            throw new Error(`Required tool ${name} is ${found.state}. ${found.hint ?? ''} ${found.note ?? ''}`);
        return [dirname(found.path)];
    });
    return [...folders, join(root, 'node_modules', '.bin'), environmentVariables()['PATH'] ?? ''].join(delimiter);
}

/**
 * Runs gspot init, leaves the named kits out of its selection, and installs the private tools.
 * @param cwd the planted repository, with one commit
 * @param argv the init command line
 * @param environment extra variables, such as the PATH of the tools
 * @param without the kits to leave out before the tools install
 */
export async function install(
    cwd: string,
    argv: string[],
    environment: Record<string, string> = {},
    without: string[] = [],
): Promise<void> {
    const outcome = await run(cwd, argv, environment);
    if (outcome.code !== 0)
        throw new Error(`Sandbox init failed with status ${String(outcome.code)}: ${outcome.stderr}${outcome.stdout}`);
    if (await Bun.file(join(cwd, 'gspot.toml')).exists()) {
        if (without.length > 0) await leaveOut(cwd, without, environment);
        await installPrivateTools(cwd);
        return;
    }
    throw new Error(`The init command wrote no policy in the planted repository: ${outcome.stderr}${outcome.stdout}`);
}

/** Install generated, locked tool projects through the public command. */
export async function installPrivateTools(cwd: string): Promise<void> {
    // No release of gspot exists yet, so a sandbox with a mise runner skips its own pin as this repository does.
    const outcome = await processes.run([process.execPath, gspot, 'install'], {
        cwd,
        env: { NO_COLOR: '1', CI: '1', MISE_DISABLE_TOOLS: 'npm:@gspothq/cli' },
        timeoutMs: INSTALL_TIMEOUT_MS,
    });
    if (outcome.code !== 0)
        throw new Error(
            `Sandbox installation failed with status ${String(outcome.code)}: ${outcome.stderr}${outcome.stdout}`,
        );
}

/**
 * Installs the sandbox with the init arguments, then selects the level every planted check runs at.
 * @param cwd the sandbox
 * @param argv the init arguments
 * @param environment the PATH the commands run with
 * @param level the level to select
 * @param without the kits to leave out before the tools install
 */
export async function installAtLevel(
    cwd: string,
    argv: string[],
    environment: Record<string, string>,
    level: 'recommended' | 'all' = 'all',
    without: string[] = [],
): Promise<void> {
    await install(cwd, argv, environment, without);
    const selected = await run(cwd, ['set', 'level', level], environment);
    if (selected.code !== 0)
        throw new Error(`The ${level} level was not selected: ${selected.stdout}${selected.stderr}`);
}

/**
 * Generate selected Semgrep rules and install their locked Python environment in a sandbox.
 * @param root the sandbox with its policy and planted sources
 */
export async function installSemgrep(root: string): Promise<void> {
    const session = await openSession(root);
    const outputs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(
        ({ path }) => path.includes('/semgrep/') || path.endsWith('.semgrepignore') || path === '.gspot/pyproject.toml',
    );
    await runOwnedLifecycle(root, async (owner) => {
        await preparePythonProject(root, outputs, owner);
    });
    for (const output of outputs) await Bun.write(join(root, output.path), output.content);
    await runOwnedLifecycle(root, (owner) => installPythonProject(root, owner));
}

// Runs the development gspot and git in a planted repository.
import { fileURLToPath } from 'node:url';
import { delimiter, dirname, join } from 'node:path';
import type { PlantedCase, SpawnOutcome } from '#types/run.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));

// Deletes the files a case removes, and returns what they held.
async function takenOut(cwd: string, gone: string[]): Promise<Map<string, string>> {
    const removed = new Map<string, string>();
    for (const path of gone) removed.set(path, await Bun.file(join(cwd, path)).text());
    for (const path of gone) Bun.spawnSync(['rm', '-f', join(cwd, path)]);
    return removed;
}

// Writes the defect into the repository and returns the function that takes it out again.
async function plant(cwd: string, planted: PlantedCase): Promise<() => Promise<void>> {
    const policyPath = join(cwd, 'gspot.toml');
    const policy = await Bun.file(policyPath).text();
    const removed = await takenOut(cwd, planted.removed ?? []);
    const planting = Object.entries(planted.files);
    for (const [path] of planting)
        if (await Bun.file(join(cwd, path)).exists()) removed.set(path, await Bun.file(join(cwd, path)).text());
    for (const [path, text] of planting) await Bun.write(join(cwd, path), text);
    const executables = planted.executable ?? [];
    for (const path of executables) Bun.spawnSync(['chmod', '+x', join(cwd, path)]);
    await Bun.write(policyPath, plantedPolicy(policy, planted));
    return async () => {
        for (const path of Object.keys(planted.files)) Bun.spawnSync(['rm', '-f', join(cwd, path)]);
        for (const [path, text] of removed) await Bun.write(join(cwd, path), text);
        await Bun.write(policyPath, policy);
    };
}

function plantedPolicy(policy: string, planted: PlantedCase): string {
    const edited = planted.policyEdit === undefined ? policy : policy.replace(...planted.policyEdit);
    return planted.policy === undefined ? edited : `${edited}\n${planted.policy}`;
}

/** How long a planted-repository test may take: it spawns real tools. */
export const PLANTED_TIMEOUT_MS = 60_000;

/** The development entry point, run with bun. */
export const gspot = join(root, 'packages', 'cli', 'src', 'main.ts');

/** A clean bash script every planted repository starts from. */
export const script =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.0+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\nmain() {\n    echo "hello $1"\n}\n\nmain "$@"\n';

/**
 * Runs gspot in a directory with color off and CI set.
 * @param cwd the planted repository
 * @param argv the command line after gspot
 * @param environment extra variables
 * @returns the exit code and both streams
 */
export function run(cwd: string, argv: string[], environment: Record<string, string> = {}): SpawnOutcome {
    const result = Bun.spawnSync(['bun', gspot, ...argv], {
        cwd,
        env: { ...environmentVariables(), NO_COLOR: '1', CI: '1', ...environment },
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: PLANTED_TIMEOUT_MS * 2,
    });
    if (result.exitedDueToTimeout === true)
        throw new Error(
            `Command gspot ${argv.join(' ')} timed out in ${cwd}.\n${result.stdout.toString()}${result.stderr.toString()}`,
        );
    return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

/**
 * Runs git with a throwaway identity.
 * @param cwd the planted repository
 * @param argv the command line after git
 * @param environment extra variables
 * @returns the exit code and both streams
 */
export function git(cwd: string, argv: string[], environment: Record<string, string> = {}): SpawnOutcome {
    const result = Bun.spawnSync(
        [
            'git',
            '-c',
            'user.email=t@t',
            '-c',
            'user.name=t',
            '-c',
            'maintenance.auto=false',
            '-c',
            'gc.auto=0',
            ...argv,
        ],
        {
            cwd,
            env: { ...environmentVariables(), ...environment },
            stdout: 'pipe',
            stderr: 'pipe',
        },
    );
    return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

/**
 * A PATH that starts with the folders of the named mise-installed tools, for a planted repository outside this one.
 * @param names the tool names as mise knows them (`taplo`, `npm:v8r`)
 * @returns the PATH value
 */
export function toolsPath(names: string[]): string {
    const folders = names.flatMap((name) => {
        const result = Bun.spawnSync(['mise', 'which', name.replace(/^[a-z]+:/u, '')], {
            cwd: root,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const found = result.stdout.toString().trim();
        return found !== '' && result.exitCode === 0 ? [dirname(found)] : [];
    });
    return [...folders, environmentVariables()['PATH'] ?? ''].join(delimiter);
}

/**
 * Makes the planted directory a git repository with one commit, the state init expects.
 * @param cwd the planted repository
 */
export function commitAll(cwd: string): void {
    git(cwd, ['init', '-q']);
    git(cwd, ['add', '-A']);
    git(cwd, ['commit', '-qm', 'init']);
}

/**
 * Plants one defect in an installed repository, runs its check alone, and restores the repository.
 * @param cwd the planted repository, already installed
 * @param planted the defect
 * @param environment extra variables, such as the PATH of the tools
 * @returns the exit code and the output of the check
 */
export async function runPlanted(
    cwd: string,
    planted: PlantedCase,
    environment: Record<string, string>,
): Promise<SpawnOutcome> {
    const restore = await plant(cwd, planted);
    const outcome = run(cwd, ['check', planted.id, '--no-cache'], environment);
    await restore();
    return outcome;
}

/**
 * Runs gspot init in a planted repository, and stops the test with what init printed when it wrote no policy.
 * A nonzero exit alone is not a failure: init exits nonzero when a tool is missing on this machine, after it wrote everything.
 * @param cwd the planted repository, with one commit
 * @param argv the init command line
 * @param environment extra variables, such as the PATH of the tools
 */
export async function install(cwd: string, argv: string[], environment: Record<string, string> = {}): Promise<void> {
    const outcome = run(cwd, argv, environment);
    if (await Bun.file(join(cwd, 'gspot.toml')).exists()) return;
    throw new Error(`The init command wrote no policy in the planted repository: ${outcome.stderr}${outcome.stdout}`);
}

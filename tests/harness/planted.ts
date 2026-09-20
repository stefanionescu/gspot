// Runs the development gspot and git in a planted repository.
import { fileURLToPath } from 'node:url';
import { delimiter, dirname, join } from 'node:path';
import { run as runProcess } from '#cli/platform/spawn.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { PlantedCase, SpawnOutcome } from '#tests/types/acceptance.ts';
import { chmodSync, mkdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../..', import.meta.url));

function originalFile(path: string): { bytes: Uint8Array; mode: number } | undefined {
    try {
        const mode = statSync(path).mode;
        return { bytes: readFileSync(path), mode };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

function isAbsent(path: string): boolean {
    try {
        statSync(path);
        return false;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
        throw error;
    }
}

function absentParents(cwd: string, paths: string[]): string[] {
    const parents = new Set<string>();
    for (const path of paths) {
        let parent = dirname(join(cwd, path));
        while (parent !== cwd && isAbsent(parent)) {
            parents.add(parent);
            parent = dirname(parent);
        }
    }
    return [...parents].toSorted((a, b) => b.length - a.length);
}

function restoreFiles(cwd: string, originals: Map<string, { bytes: Uint8Array; mode: number } | undefined>): void {
    for (const [path, original] of originals) {
        const full = join(cwd, path);
        if (original === undefined) rmSync(full, { force: true });
        else {
            writeFileSync(full, original.bytes);
            chmodSync(full, original.mode);
        }
    }
}

function removeParents(parents: string[]): void {
    for (const path of parents) {
        try {
            rmdirSync(path);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
}

function plantFiles(cwd: string, planted: PlantedCase, policy: string): void {
    const { removed = [], executable = [] } = planted;
    for (const path of removed) rmSync(join(cwd, path));
    for (const [path, text] of Object.entries(planted.files)) {
        const full = join(cwd, path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, text);
    }
    for (const path of executable) chmodSync(join(cwd, path), statSync(join(cwd, path)).mode | 0o111);
    writeFileSync(join(cwd, 'gspot.toml'), policy);
}

// Preserve bytes and permissions before the first mutation, including setup that fails partway through.
function plant(cwd: string, planted: PlantedCase): () => void {
    const policyPath = join(cwd, 'gspot.toml');
    const policy = plantedPolicy(readFileSync(policyPath, 'utf8'), planted);
    const gone = planted.removed ?? [];
    const executables = planted.executable ?? [];
    const paths = [...new Set(['gspot.toml', ...gone, ...executables, ...Object.keys(planted.files)])];
    const originals = new Map(paths.map((path) => [path, originalFile(join(cwd, path))]));
    for (const path of gone)
        if (originals.get(path) === undefined) throw new Error(`The sandbox removal target ${path} is absent.`);
    const parents = absentParents(cwd, paths);
    const restore = (): void => {
        restoreFiles(cwd, originals);
        removeParents(parents);
    };
    try {
        plantFiles(cwd, planted, policy);
    } catch (error) {
        restore();
        throw error;
    }
    return restore;
}

function plantedPolicy(policy: string, planted: PlantedCase): string {
    const edited = planted.policyEdit === undefined ? policy : policy.replace(...planted.policyEdit);
    if (edited === policy && planted.policyEdit !== undefined)
        throw new Error(`The policy edit for ${planted.check} did not change the sandbox.`);
    return planted.policy === undefined ? edited : `${edited}\n${planted.policy}`;
}

/** How long a planted-repository test may take: it spawns real tools. */
export const PLANTED_TIMEOUT_MS = 60_000;

/** The development entry point, run with bun. */
export const gspot = join(root, 'packages', 'cli', 'src', 'main.ts');

/** A clean bash script every planted repository starts from. */
export const script =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\nmain() {\n    echo "hello $1"\n}\n\nmain "$@"\n';

/**
 * Runs gspot in a directory with color off and CI set.
 * @param cwd the planted repository
 * @param argv the command line after gspot
 * @param environment extra variables
 * @returns the exit code and both streams
 */
export async function run(
    cwd: string,
    argv: string[],
    environment: Record<string, string> = {},
): Promise<SpawnOutcome> {
    const result = await runProcess([process.execPath, gspot, ...argv], {
        cwd,
        env: { NO_COLOR: '1', CI: '1', ...environment },
        timeoutMs: PLANTED_TIMEOUT_MS * 2,
    });
    if (result.isTimedOut === true)
        throw new Error(
            `Command gspot ${argv.join(' ')} timed out in ${cwd}.\n` +
                `Duration: ${result.duration.toFixed(0)} ms; exit: ${String(result.code)}.\n` +
                `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
        );
    if (result.missing) throw new Error(`Could not launch gspot: ${result.stderr}`);
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
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
 * A PATH with the required mise tools and this checkout's npm tools for an external sandbox.
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
        if (found === '' || result.exitCode !== 0)
            throw new Error(
                `Required tool ${name} is unavailable. Run mise install ${name}. ${result.stderr.toString()}`,
            );
        return [dirname(found)];
    });
    return [...folders, join(root, 'node_modules', '.bin'), environmentVariables()['PATH'] ?? ''].join(delimiter);
}

/**
 * Makes the planted directory a git repository with one commit, the state init expects.
 * @param cwd the planted repository
 */
export function commitAll(cwd: string): void {
    for (const args of [
        ['init', '-q'],
        ['add', '-A'],
        ['commit', '-qm', 'init'],
    ]) {
        const result = git(cwd, args);
        if (result.code !== 0) throw new Error(`Sandbox Git setup failed: ${result.stderr}${result.stdout}`);
    }
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
    const restore = plant(cwd, planted);
    try {
        return await run(cwd, ['check', '--only', planted.check, '--no-cache'], environment);
    } finally {
        restore();
    }
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
    if (await Bun.file(join(cwd, 'gspot.toml')).exists()) return;
    throw new Error(`The init command wrote no policy in the planted repository: ${outcome.stderr}${outcome.stdout}`);
}

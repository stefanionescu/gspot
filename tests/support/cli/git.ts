import { environmentVariables } from '#cli/platform/environment.ts';
import type { SpawnOutcome } from '#tests/support/cli/command.ts';

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

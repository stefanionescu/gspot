// A session whose one planted check passes or prints a finding, for tests of cache and report storage.
import { openSession } from '#cli/execution/session.ts';
import type { Stage } from '#cli/types/configurations.ts';
import type { Session } from '#cli/types/execution/execution.ts';

/**
 * Opens the sandbox and replaces its selection with one command check that exits with the status.
 * @param root the sandbox root
 * @param status the exit status of the planted check; 1 prints a retained finding
 * @param stage the stage the check runs at
 * @returns the session
 */
export async function storageSession(root: string, status: number, stage: Stage = 'commit'): Promise<Session> {
    const session = await openSession(root);
    const manifest = session.manifests.get('typescript')!;
    const script = status === 0 ? 'process.exitCode = 0' : "console.log('Retained finding'); process.exitCode = 1";
    session.scopes[0]!.selected = [
        {
            ...manifest,
            tools: [],
            checks: [
                {
                    level: 'recommended',
                    runs: 'per-scope',
                    coverage: [],
                    summary: 'Reports the planted storage finding.',
                    why: 'Storage failures preserve the check result.',
                    help: 'Fix the planted finding.',
                    claims: manifest.claims,
                    name: 'sandbox/storage',
                    stage,
                    cwd: 'root',
                    command: [process.execPath, '-e', script],
                    output: { format: 'lines' },
                },
            ],
        },
    ];
    return session;
}

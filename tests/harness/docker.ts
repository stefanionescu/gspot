// Docker-dependent scenarios probe the daemon lazily without blocking unrelated test imports.
import { runBlocking } from '#cli/platform/public.ts';
import { prepareTestCommand } from '#tests/harness/command.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';

let available: boolean | undefined;

/**
 * Probe Docker once with the remaining test time and require Linux containers.
 * @returns whether Docker-dependent native scenarios can run
 */
export function hasLinuxDocker(): boolean {
    if (available !== undefined) return available;
    if (Bun.which('docker') === null) {
        available = false;
        return available;
    }
    const command = ['docker', 'info', '--format', '{{.OSType}}'];
    const result = runBlocking(command, prepareTestCommand(command, { cwd: root }, 'Docker availability').options);
    available = result.code === 0 && result.stdout.trim() === 'linux';
    return available;
}

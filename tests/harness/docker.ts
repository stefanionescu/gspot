// Docker-dependent scenarios probe the daemon lazily without blocking unrelated test imports.
import { runBlocking } from '#cli/platform/spawn.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { DOCKER_STARTUP_TIMEOUT_MS } from '#tests/config/harness/docker.ts';

let available: boolean | undefined;

/**
 * Probe Docker once with the bounded startup limit and require Linux containers.
 * @returns whether Docker-dependent native scenarios can run
 */
export function hasLinuxDocker(): boolean {
    if (available !== undefined) return available;
    if (Bun.which('docker') === null) {
        available = false;
        return available;
    }
    const result = runBlocking(['docker', 'info', '--format', '{{.OSType}}'], {
        cwd: root,
        timeoutMs: DOCKER_STARTUP_TIMEOUT_MS,
    });
    available = result.code === 0 && result.stdout.trim() === 'linux';
    return available;
}

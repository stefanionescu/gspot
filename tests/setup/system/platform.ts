import { runBlockingCommand } from '#tests/setup/system/processes.ts';

export const isWindows = process.platform === 'win32';

export const isLinux = process.platform === 'linux';

export const isMacos = process.platform === 'darwin';

/**
Tell whether a Docker daemon that runs Linux containers answers. A Docker CLI without a daemon, as on the hosted macOS
image, fails the probe, and Docker Desktop on macOS passes it.
*/
export function hasLinuxDocker(): boolean {
    if (Bun.which('docker') === null) return false;
    const daemon = runBlockingCommand(['docker', 'info', '--format', '{{.OSType}}'], { cwd: process.cwd() });
    return daemon.code === 0 && daemon.stdout.trim() === 'linux';
}

export function fakePlatform(platform: NodeJS.Platform): Disposable {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { value: platform });
    return {
        [Symbol.dispose]: () => {
            Object.defineProperty(process, 'platform', descriptor);
        },
    };
}

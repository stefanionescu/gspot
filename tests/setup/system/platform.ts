import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool, findMissingBuild } from '#cli/tools/pins.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';

export const isWindows = process.platform === 'win32';

export const isLinux = process.platform === 'linux';

export const isMacos = process.platform === 'darwin';

export function hasToolBuild(name: string): boolean {
    const operatingSystem = getOperatingSystem();
    const pin = getTool(readConfigurations().values(), name);
    return findMissingBuild(pin, { platform: operatingSystem, arch: process.arch }) === undefined;
}

/**
Make process.platform report another system until disposal.
*/
export function fakePlatform(platform: NodeJS.Platform): Disposable {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { value: platform });
    return {
        [Symbol.dispose]: () => {
            Object.defineProperty(process, 'platform', descriptor);
        },
    };
}

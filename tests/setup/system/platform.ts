import { getOperatingSystem } from '#cli/system/environment.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { getTool, findMissingBuild } from '#cli/configurations/tools.ts';

export const isWindows = process.platform === 'win32';

export const FOLDER_LINK_TYPE = isWindows ? 'junction' : 'dir';

export const isLinux = process.platform === 'linux';

export const isMacos = process.platform === 'darwin';

/**
 * Whether the pinned tool has a build for this machine.
 *
 * @param name tool as its manifest pins it.
 * @returns whether a tool test may run it here.
 */
export function hasToolBuild(name: string): boolean {
    const operatingSystem = getOperatingSystem();
    const pin = getTool(readConfigurations().values(), name);
    return findMissingBuild(pin, { platform: operatingSystem, arch: process.arch }) === undefined;
}

/**
 * Make process.platform report another system until disposal.
 *
 * @param name system to report.
 * @returns a resource that restores the real value.
 */
export function simulateOperatingSystem(name: NodeJS.Platform): Disposable {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { value: name });
    return {
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: `using` calls it when the scope ends.
        [Symbol.dispose]() {
            Object.defineProperty(process, 'platform', descriptor);
        },
    };
}

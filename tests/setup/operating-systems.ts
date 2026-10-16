// Selects tool builds and temporarily changes the reported operating system.
import { getOperatingSystem } from '#cli/system/environment.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { findMissingBuild, getToolDeclaration } from '#cli/configurations/tools.ts';

/** Whether the tests run on Windows. */
export const isWindows = process.platform === 'win32';
export const isLinux = process.platform === 'linux';

/** Whether the tests run on macOS. */
export const isMacos = process.platform === 'darwin';

/**
 * Whether the pinned tool has a build for this machine.
 * @param name the tool name as its manifest pins it.
 * @returns whether a tool test may run it here.
 */
export function hasToolBuild(name: string): boolean {
    const operatingSystem = getOperatingSystem();
    const pin = getToolDeclaration(readManifests().values(), name);
    return findMissingBuild(pin, operatingSystem, process.arch) === undefined;
}

/**
 * Restore the complete operating-system descriptor after a simulated operating-system test.
 * @param name the operating system to simulate.
 * @returns the restoration resource.
 */
export function useOperatingSystem(name: NodeJS.Platform): Disposable {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Node defines process.platform on the process object.
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { value: name });
    return {
        [Symbol.dispose]() {
            Object.defineProperty(process, 'platform', descriptor);
        },
    };
}

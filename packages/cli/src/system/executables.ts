// Locates executable programs and Python environment launchers.
import { join } from 'node:path';
import { EXECUTABLE_LAYOUTS } from '#cli/config/system/paths.ts';

const systemExecutables = EXECUTABLE_LAYOUTS[process.platform === 'win32' ? 'windows' : 'posix'];

/**
 * Name executable candidates in the system's preferred shim order.
 * @param name the executable name without a suffix.
 * @returns names used by tool-project verification and tool discovery.
 */
export function executableNames(name: string): string[] {
    return systemExecutables.executableSuffixes.map((suffix) => name + suffix);
}

/**
 * Locate the command directory of a Python virtual environment.
 * @param folder the environment directory.
 * @returns its Scripts directory on Windows or bin directory elsewhere.
 */
export function virtualEnvironmentBin(folder: string): string {
    return join(folder, systemExecutables.environmentDirectory);
}

/**
 * Locate one Python interpreter or console script inside its virtual environment.
 * @param folder the environment directory.
 * @param name the executable name.
 * @returns the executable path with the system's Python launcher suffix.
 */
export function virtualEnvironmentExecutable(folder: string, name: string): string {
    return join(virtualEnvironmentBin(folder), name + systemExecutables.environmentSuffix);
}

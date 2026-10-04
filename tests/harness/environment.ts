// Isolate installed consumers from this checkout and restore test-owned environment changes.
import { workspaceRoot as root } from '#automation/workspace.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { MODULE_DIRECTORIES } from '#tests/config/harness/modules.ts';
import { sep, join, resolve, relative, delimiter, isAbsolute } from 'node:path';

const inherited = environmentVariables();

/** The installed workspace store keeps each package beside its own dependencies. */
export const installedModules = join(root, MODULE_DIRECTORIES.installed);
/** The tests package owns its isolated executable and package links. */
export const testModules = join(root, MODULE_DIRECTORIES.tests);
/** Source subprocesses find the repository's launcher through their environment. */
export const sourceLauncherDirectory = join(root, MODULE_DIRECTORIES.launchers);

// The environment of an installed consumer: no module path overrides, and no folder of this checkout on PATH.
export const consumerEnvironment: Record<string, string | undefined> = {
    ...inherited,
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
    PATH: (inherited['PATH'] ?? '')
        .split(delimiter)
        .filter((entry) => {
            const path = relative(root, resolve(entry));
            return path.startsWith(`..${sep}`) || path === '..' || isAbsolute(path);
        })
        .join(delimiter),
};

/**
 * Sets or clears one environment variable for this process and the tools it spawns.
 * @param name the variable
 * @param value the new value, or undefined to clear it
 */
export function setEnvironmentVariable(name: string, value: string | undefined): void {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
}

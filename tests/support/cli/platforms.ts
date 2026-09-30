// What this machine can and cannot do: which pinned tools ship for it, the modes it keeps, and the modules it links.
import { join, dirname } from 'node:path';
import { toolPin } from '#cli/tools/inspect.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { missingBuild } from '#cli/execution/planning/skips.ts';
import { PLATFORM_NAMES } from '#cli/config/execution/execution.ts';
import { PLANTED_MODULES, INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import { mkdirSync, existsSync, readdirSync, symlinkSync, realpathSync } from 'node:fs';

/** Whether the platform has POSIX shells, links, and modes; Windows does not. */
export const onPosix = process.platform !== 'win32';
/** Whether the macOS toolchain is at hand: plutil, xcodebuild, and the Swift compiler. */
export const onMac = process.platform === 'darwin';
/** Whether the Linux-only services of the tests, such as Docker journeys, are at hand. */
export const onLinux = process.platform === 'linux';

/**
 * Whether the pinned tool has a build for this machine.
 * @param name the tool name as its manifest pins it
 * @returns whether a native test may run it here
 */
export function toolShipsHere(name: string): boolean {
    const platform = PLATFORM_NAMES[process.platform] ?? process.platform;
    const pin = toolPin(kitManifests().values(), name);
    return missingBuild(pin, platform, process.arch) === undefined;
}

/**
 * The permission bits a file keeps on this machine. Windows stores a read-only attribute and nothing else, so a
 * writable file reads 0o666 and a read-only one 0o444 whatever mode was requested.
 * @param mode the mode a test requested on a POSIX system
 * @returns the mode the file reports here
 */
export function keptMode(mode: number): number {
    if (process.platform !== 'win32') return mode;
    return (mode & 0o200) === 0 ? 0o444 : 0o666;
}

/**
 * An executable of a Python virtual environment: Scripts/<name>.exe on Windows, bin/<name> elsewhere.
 * @param environment the environment directory, absolute or relative
 * @param name the console script or interpreter name
 * @returns the path of the executable in the environment's own layout
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every Python fixture spells the environment layout through this one owner.
export function venvExecutable(environment: string, name: string): string {
    return process.platform === 'win32' ? join(environment, 'Scripts', `${name}.exe`) : join(environment, 'bin', name);
}

/**
 * Links every installed module of this repository into a directory, entry by entry, so a relative link inside the
 * store resolves from its real location. A directory link of the whole store breaks those on Windows. The planted
 * packages of the tests store come first. The .bun folder comes along, so a copy of the sandbox keeps each package
 * beside the packages it resolves, and so does the .bin folder of the planted packages.
 * @param target the node_modules directory to create
 */
export function linkInstalledModules(target: string): void {
    const kind = process.platform === 'win32' ? 'junction' : 'dir';
    const packages = [PLANTED_MODULES, INSTALLED_MODULES].flatMap((store) =>
        readdirSync(store)
            .filter((entry) => !entry.startsWith('.'))
            .flatMap((entry) =>
                entry.startsWith('@') ? readdirSync(join(store, entry)).map((child) => join(entry, child)) : [entry],
            )
            .map((name) => [store, name] as const),
    );
    const links = [[INSTALLED_MODULES, '.bun'] as const, [PLANTED_MODULES, '.bin'] as const, ...packages];
    for (const [store, name] of links) {
        const destination = join(target, name);
        if (existsSync(destination)) continue;
        mkdirSync(dirname(destination), { recursive: true });
        symlinkSync(realpathSync(join(store, name)), destination, kind);
    }
}

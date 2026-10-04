// What this machine can and cannot do: which pinned tools ship for it, the modes it keeps, and the modules it links.
import { join, dirname } from 'node:path';
import { toolPin } from '#cli/tools/pins.ts';
import { missingBuild } from '#cli/execution/planning/skips.ts';
import { PLATFORM_NAMES } from '#cli/config/execution/planning.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { testModules, installedModules } from '#tests/harness/environment.ts';
import { mkdirSync, existsSync, readdirSync, symlinkSync, realpathSync } from 'node:fs';

/**
 * Whether the pinned tool has a build for this machine.
 * @param name the tool name as its manifest pins it
 * @returns whether a native test may run it here
 */
export function hasToolBuild(name: string): boolean {
    const platform = PLATFORM_NAMES[process.platform] ?? process.platform;
    const pin = toolPin(configurationManifests().values(), name);
    return missingBuild(pin, platform, process.arch) === undefined;
}

/**
 * The permission bits a file keeps on this machine. Windows stores a read-only attribute and nothing else, so a
 * writable file reads 0o666 and a read-only one 0o444 whatever mode was requested.
 * @param mode the mode a test requested on a POSIX system
 * @returns the mode the file reports here
 */
export function getKeptMode(mode: number): number {
    if (process.platform !== 'win32') return mode;
    return (mode & 0o200) === 0 ? 0o444 : 0o666;
}

/**
 * Links every installed module of this repository into a directory, entry by entry, so a relative link inside the
 * store resolves from its real location. A directory link of the whole store breaks those on Windows. The test
 * packages of the tests store come first. The .bun folder comes along, so a copy of the sandbox keeps each package
 * beside the packages it resolves, and so does the .bin folder of the test packages.
 * @param target the node_modules directory to create
 */
export function linkInstalledModules(target: string): void {
    const kind = process.platform === 'win32' ? 'junction' : 'dir';
    const packages = [testModules, installedModules].flatMap((store) =>
        readdirSync(store)
            .filter((entry) => !entry.startsWith('.'))
            .flatMap((entry) =>
                entry.startsWith('@') ? readdirSync(join(store, entry)).map((child) => join(entry, child)) : [entry],
            )
            .map((name) => [store, name] as const),
    );
    const links = [[installedModules, '.bun'] as const, [testModules, '.bin'] as const, ...packages];
    for (const [store, name] of links) {
        const destination = join(target, name);
        if (existsSync(destination)) continue;
        mkdirSync(dirname(destination), { recursive: true });
        symlinkSync(realpathSync(join(store, name)), destination, kind);
    }
}

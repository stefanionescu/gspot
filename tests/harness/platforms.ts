// What this machine can and cannot do: which pinned tools ship for it, the modes it keeps, and the modules it links.
import { join, dirname } from 'node:path';
import { hostPlatform } from '#cli/platform/public.ts';
import { missingBuild } from '#cli/planning/contracts.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { mkdir, readdir, symlink, realpath } from 'node:fs/promises';
import { configurationManifests } from '#cli/configurations/public.ts';
import { testModules, installedModules } from '#tests/harness/environment.ts';

/**
 * Whether the pinned tool has a build for this machine.
 * @param name the tool name as its manifest pins it
 * @returns whether a native test may run it here
 */
export function hasToolBuild(name: string): boolean {
    const platform = hostPlatform();
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
export async function linkInstalledModules(target: string): Promise<void> {
    const kind = process.platform === 'win32' ? 'junction' : 'dir';
    const packages = await Promise.all(
        [testModules, installedModules].map(async (store) => {
            const entries = await readdir(store);
            const names = await Promise.all(
                entries
                    .filter((entry) => !entry.startsWith('.'))
                    .map(async (entry) => {
                        if (!entry.startsWith('@')) return [entry];
                        const children = await readdir(join(store, entry));
                        return children.map((child) => join(entry, child));
                    }),
            );
            return names.flat().map((name) => [store, name] as const);
        }),
    );
    const links = [[installedModules, '.bun'] as const, [testModules, '.bin'] as const, ...packages.flat()];
    for (const [store, name] of links) {
        const destination = join(target, name);
        if (await pathExists(destination)) continue;
        await mkdir(dirname(destination), { recursive: true });
        const original = await realpath(join(store, name));
        await symlink(original, destination, kind);
    }
}

/**
 * Restore the complete platform descriptor after a simulated host test.
 * @param name the host platform to simulate
 * @returns the restoration resource
 */
export function usePlatform(name: NodeJS.Platform): Disposable {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { value: name });
    return {
        [Symbol.dispose]() {
            Object.defineProperty(process, 'platform', descriptor);
        },
    };
}

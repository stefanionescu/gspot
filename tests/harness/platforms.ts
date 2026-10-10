// What this machine can and cannot do: which pinned tools ship for it, the modes it keeps, and the modules it links.
import { hostPlatform } from '#cli/platform/public.ts';
import { missingBuild } from '#cli/planning/contracts.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { quoteArgument } from '#cli/platform/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { join, dirname, relative, basename } from 'node:path';
import { configurationManifests } from '#cli/configurations/public.ts';
import { testModules, installedModules } from '#tests/harness/environment.ts';
import { cp, mkdir, lstat, chmod, readdir, symlink, realpath, copyFile, writeFile } from 'node:fs/promises';

/**
 * List installed packages, including names in scoped folders.
 * @param store the installed module folder
 * @returns package names in native directory order
 */
async function packageNames(store: string): Promise<string[]> {
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
    return names.flat();
}

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
 * Link test packages before workspace packages, with their .bin and the workspace .bun store.
 * Canonical package links preserve relative dependencies that Windows store junctions break.
 * Copied sandboxes retain the installed dependency layout.
 * @param target the node_modules directory to create
 */
export async function linkInstalledModules(target: string): Promise<void> {
    const kind = process.platform === 'win32' ? 'junction' : 'dir';
    const packages = await Promise.all(
        [testModules, installedModules].map(async (store) => {
            const names = await packageNames(store);
            return names.map((name) => [store, name] as const);
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

/**
 * Copy a cached module into the sandbox with its bins and dependency store.
 * @param target the sandbox's node_modules folder
 * @param name the installed package and executable name
 */
export async function copyInstalledModule(target: string, name: string): Promise<void> {
    const source = await realpath(join(testModules, name));
    const destination = join(target, name);
    await cp(source, destination, { recursive: true });
    const store = dirname(source);
    for (const dependency of await packageNames(store)) {
        const path = join(destination, 'node_modules', dependency);
        await mkdir(dirname(path), { recursive: true });
        await symlink(await realpath(join(store, dependency)), path, process.platform === 'win32' ? 'junction' : 'dir');
    }
    const binaries = join(target, '.bin');
    await mkdir(binaries, { recursive: true });
    const installed = join(testModules, '.bin');
    const entries = await readdir(installed);
    for (const file of entries.filter((entry) => entry === name || entry.startsWith(`${name}.`))) {
        const original = join(installed, file);
        const path = join(binaries, file);
        const entry = await lstat(original);
        if (entry.isSymbolicLink()) {
            const program = join(destination, relative(source, await realpath(original)));
            await symlink(relative(binaries, program), path, 'file');
        } else await copyFile(original, path);
    }
}

/**
 * Write a child script and its native wrappers.
 * @param root the sandbox root.
 * @param name the executable path without a Windows suffix.
 * @param script the Bun program, retained verbatim.
 * @returns the directory to add to PATH.
 */
export async function fakeTool(root: string, name: string, script: string): Promise<string> {
    const target = join(root, name);
    const folder = dirname(target);
    const filename = basename(target);
    await mkdir(folder, { recursive: true });
    await writeFile(`${target}.js`, script);
    await writeFile(target, `#!/bin/sh\nexec ${quoteArgument(process.execPath)} "\${0%/*}/${filename}.js" "$@"\n`);
    await writeFile(`${target}.cmd`, `@echo off\r\n"${process.execPath}" "%~dp0${filename}.js" %*\r\n`);
    await chmod(target, 0o755);
    return folder;
}

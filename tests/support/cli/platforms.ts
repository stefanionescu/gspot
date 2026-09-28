// What this machine can and cannot do: which pinned tools ship for it, the modes it keeps, and how it runs a launcher.
import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { toolPin } from '#cli/tools/inspect.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { missingBuild } from '#cli/tools/platforms.ts';
import { PLATFORM_NAMES } from '#cli/config/execution/execution.ts';
import { chmodSync, mkdirSync, readdirSync, symlinkSync, realpathSync } from 'node:fs';

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
 * The permission bits a directory keeps on this machine; Windows reports every directory as 0o777.
 * @param mode the mode a test requested on a POSIX system
 * @returns the mode the directory reports here
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Directory modes have one owner beside the file modes, so a test never spells the Windows value.
export function keptDirectoryMode(mode: number): number {
    return process.platform === 'win32' ? 0o777 : mode;
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
 * Plants a launcher that records what a hook or runner hands it. A POSIX host runs the script through its shebang.
 * Windows cannot: a hook's shell spells the script path the POSIX way, which Bun does not read. There the script
 * lives beside a shell wrapper that converts the path, and beside a command file for a runner or a direct spawn.
 * @param root the directory the path is relative to
 * @param path the launcher path a hook finds on PATH, such as bin/gspot
 * @param script the Bun script body that runs with the launcher's arguments
 */
export async function plantLauncher(root: string, path: string, script: string): Promise<void> {
    if (process.platform !== 'win32') {
        await createFileTree(root, { [path]: `#!${process.execPath}\n${script}` });
        chmodSync(join(root, path), 0o755);
        return;
    }
    const bun = process.execPath.replaceAll('\\', '/');
    const name = path.slice(path.lastIndexOf('/') + 1);
    await createFileTree(root, {
        [`${path}.mjs`]: script,
        [path]: `#!/bin/sh\nscript=$(cygpath -w "$0" 2>/dev/null || printf '%s' "$0")\nexec "${bun}" "$script.mjs" "$@"\n`,
        [`${path}.cmd`]: `@"${process.execPath}" "%~dp0${name}.mjs" %*\r\n`,
    });
}

/**
 * Links every installed module of this repository into a directory, entry by entry, so a relative link inside the
 * store resolves from its real location. A directory link of the whole store breaks those on Windows.
 * @param target the node_modules directory to create
 */
export function linkInstalledModules(target: string): void {
    const store = join(import.meta.dir, '../../../node_modules');
    const kind = process.platform === 'win32' ? 'junction' : 'dir';
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(store)) {
        if (entry.startsWith('.')) continue;
        if (!entry.startsWith('@')) {
            symlinkSync(realpathSync(join(store, entry)), join(target, entry), kind);
            continue;
        }
        mkdirSync(join(target, entry), { recursive: true });
        for (const child of readdirSync(join(store, entry)))
            symlinkSync(realpathSync(join(store, entry, child)), join(target, entry, child), kind);
    }
}

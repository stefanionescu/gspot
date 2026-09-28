// What this machine can and cannot do: which pinned tools ship for it, the modes it keeps, and how it runs a launcher.
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { createFileTree } from 'testdirs';
import { toolPin } from '#cli/tools/inspect.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { missingBuild } from '#cli/tools/platforms.ts';
import { PLATFORM_NAMES } from '#cli/config/execution/execution.ts';

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
 * On Windows a hook's shell runs the script through env, which hands Bun a Windows path. A direct interpreter in the
 * shebang gets the shell's POSIX spelling instead. A runner or a direct spawn uses the command file beside it.
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
    const name = path.slice(path.lastIndexOf('/') + 1);
    await createFileTree(root, {
        [path]: `#!/usr/bin/env bun\n${script}`,
        [`${path}.cmd`]: `@"${process.execPath}" "%~dp0${name}" %*\r\n`,
    });
}

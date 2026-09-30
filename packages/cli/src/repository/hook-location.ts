// Where Git runs this clone's hooks from.
import { resolve } from 'node:path';
import { runBlocking } from '#cli/platform/spawn.ts';

/**
 * The folder Git runs hooks from: core.hooksPath when set, otherwise the hooks folder of the Git directory.
 * @param root the repository root
 * @returns the absolute path
 */
export function hooksDirectory(root: string): string {
    const result = runBlocking(['git', 'rev-parse', '--git-path', 'hooks'], { cwd: root });
    if (result.code !== 0) throw new Error(`Cannot resolve the Git hooks folder: ${result.stderr.trim()}`);
    return resolve(root, result.stdout.replace(/\n$/u, ''));
}

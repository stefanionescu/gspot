import { join, dirname, delimiter } from 'node:path';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { FOLDER_LINK_TYPE } from '#tests/setup/system/platform.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import type { PackageJson } from '#cli/types/parsers/projects/dependencies.ts';
import { mkdir, readdir, symlink, readFile, realpath } from 'node:fs/promises';

export const workspaceModules = join(import.meta.dir, '../../../node_modules');

export const testModules = join(import.meta.dir, '../../node_modules');

async function listPackageNames(store: string): Promise<string[]> {
    const listed = await readdir(store);
    const names = await Promise.all(
        listed
            .filter((stored) => !stored.startsWith('.'))
            .map(async (name) => {
                if (!name.startsWith('@')) return [name];
                const children = await readdir(join(store, name));
                return children.map((child) => join(name, child));
            }),
    );
    return names.flat();
}

/**
Link test packages before workspace packages, with their .bin and the workspace .bun store.
Links to the real package folders keep relative dependencies that Windows store junctions break.
Copied sandboxes keep the installed dependency layout.

@param modulesFolder the node_modules folder to create.
*/
export async function linkInstalledModules(modulesFolder: string): Promise<void> {
    const packages = await Promise.all(
        [testModules, workspaceModules].map(async (store) => {
            const names = await listPackageNames(store);
            return names.map((name) => [store, name] as const);
        }),
    );
    const links = [[workspaceModules, '.bun'] as const, [testModules, '.bin'] as const, ...packages.flat()];
    for (const [store, name] of links) {
        const destination = join(modulesFolder, name);
        if (await isOnDisk(destination)) continue;
        await mkdir(dirname(destination), { recursive: true });
        const original = await realpath(join(store, name));
        await symlink(original, destination, FOLDER_LINK_TYPE);
    }
}

/**
Link declared packages and the installed packages they depend on, so a copy of node_modules holds only those. A test
package wins over a workspace package of the same name, as in linkInstalledModules.

@param modulesFolder the node_modules folder to create.
@param names packages that the sandbox project declares.
*/
export async function linkPackages(modulesFolder: string, names: readonly string[]): Promise<void> {
    const pending = await Promise.all(
        names.map(
            async (name) =>
                [name, join((await isOnDisk(join(testModules, name))) ? testModules : workspaceModules, name)] as const,
        ),
    );
    const found = new Map<string, string>();
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
        const [name, path] = next;
        if (found.has(name) || !(await isOnDisk(path))) continue;
        const canonical = await realpath(path);
        found.set(name, canonical);
        const packageJson = JSON.parse(await readFile(join(canonical, 'package.json'), 'utf8')) as PackageJson;
        const folder = join(canonical, ...name.split('/').map(() => '..'));
        const dependencies = {
            ...packageJson.dependencies,
            ...packageJson.optionalDependencies,
            ...packageJson.peerDependencies,
        };
        for (const dependency of Object.keys(dependencies)) pending.push([dependency, join(folder, dependency)]);
    }
    for (const [name, real] of found) {
        const destination = join(modulesFolder, name);
        await mkdir(dirname(destination), { recursive: true });
        await symlink(real, destination, FOLDER_LINK_TYPE);
    }
}

/** Link the installed TypeScript package and its executable launchers. */
export async function linkTypescript(root: string, folder = join(root, 'node_modules')): Promise<string> {
    await mkdir(folder, { recursive: true });
    await linkPackages(folder, ['typescript']);
    await symlink(await realpath(join(testModules, '.bin')), join(folder, '.bin'), FOLDER_LINK_TYPE);
    return [join(folder, '.bin'), readEnvironmentVariable('PATH') ?? ''].join(delimiter);
}

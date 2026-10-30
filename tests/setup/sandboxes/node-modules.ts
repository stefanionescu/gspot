import { join, dirname } from 'node:path';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import type { PackageJson } from '#cli/types/parsers/projects.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { IGNORE_ALL_PATTERN } from '#tests/config/setup/sandboxes.ts';
import { mkdir, readdir, symlink, readFile, realpath, writeFile } from 'node:fs/promises';

const FOLDER_LINK_TYPE = isWindows ? 'junction' : 'dir';

export const workspaceModules = join(REPOSITORY_ROOT, 'node_modules');

const testModules = join(import.meta.dir, '../../node_modules');

export const toolModules = join(workspaceModules, '.test-tools/node_modules');

async function listPackageNames(modulesFolder: string): Promise<string[]> {
    const listed = await readdir(modulesFolder);
    const names = await Promise.all(
        listed
            .filter((stored) => !stored.startsWith('.'))
            .map(async (name) => {
                if (!name.startsWith('@')) return [name];
                const children = await readdir(join(modulesFolder, name));
                return children.map((child) => join(name, child));
            }),
    );
    return names.flat();
}

/**
Link tool packages before test and workspace packages, with the tool .bin and the workspace .bun store.
Links to the real package folders keep relative dependencies that Windows store junctions break.
*/
export async function linkInstalledModules(modulesFolder: string): Promise<void> {
    const packages = await Promise.all(
        [toolModules, testModules, workspaceModules].map(async (store) => {
            const names = await listPackageNames(store);
            return names.map((name) => [store, name] as const);
        }),
    );
    const links = [[workspaceModules, '.bun'] as const, [toolModules, '.bin'] as const, ...packages.flat()];
    for (const [store, name] of links) {
        const destination = join(modulesFolder, name);
        if (await isOnDisk(destination)) continue;
        await mkdir(dirname(destination), { recursive: true });
        await symlink(await realpath(join(store, name)), destination, FOLDER_LINK_TYPE);
    }
    await writeFile(join(modulesFolder, '.gitignore'), IGNORE_ALL_PATTERN);
}

/**
Link declared packages and the installed packages they depend on, so a copy of node_modules holds only those. A tool
package wins over a test or workspace package of the same name, as in linkInstalledModules.
*/
export async function linkPackages(modulesFolder: string, names: readonly string[]): Promise<void> {
    const pending = await Promise.all(
        names.map(async (name) => {
            const stores = [toolModules, testModules];
            const found = await Promise.all(stores.map((store) => isOnDisk(join(store, name))));
            return [name, join(stores[found.indexOf(true)] ?? workspaceModules, name)] as const;
        }),
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
    for (const [name, target] of found) {
        const destination = join(modulesFolder, name);
        await mkdir(dirname(destination), { recursive: true });
        await symlink(target, destination, FOLDER_LINK_TYPE);
    }
}

/**
Link the installed TypeScript package and its executable launchers.
*/
export async function linkTypescript(modulesFolder: string): Promise<void> {
    await mkdir(modulesFolder, { recursive: true });
    await linkPackages(modulesFolder, ['typescript']);
    await symlink(await realpath(join(toolModules, '.bin')), join(modulesFolder, '.bin'), FOLDER_LINK_TYPE);
    await writeFile(join(modulesFolder, '.gitignore'), IGNORE_ALL_PATTERN);
}

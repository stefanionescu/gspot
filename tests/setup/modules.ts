// Links installed npm packages into test projects.
import { join, dirname } from 'node:path';
import { isOnDisk } from '#tests/setup/files.ts';
import { isWindows } from '#tests/setup/system.ts';
import type { PackageJson } from '#cli/types/parsers/dependency-files.ts';
import { mkdir, readdir, symlink, readFile, realpath } from 'node:fs/promises';

/** The node_modules folder of the repository root, where each package sits beside its dependencies. */
const installedModules = join(import.meta.dir, '../../node_modules');

/** The node_modules folder of the tests package. It holds the package programs and links. */
const testModules = join(import.meta.dir, '../node_modules');

/**
 * List installed packages, including names in scoped folders.
 *
 * @param store the installed module folder.
 * @returns package names in filesystem order.
 */
async function listPackageNames(store: string): Promise<string[]> {
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
 * Link test packages before workspace packages, with their .bin and the workspace .bun store.
 * Links to the real package folders keep relative dependencies that Windows store junctions break.
 * Copied sandboxes keep the installed dependency layout.
 *
 * @param target the node_modules folder to create.
 */
async function linkInstalledModules(target: string): Promise<void> {
    const kind = isWindows ? 'junction' : 'dir';
    const packages = await Promise.all(
        [testModules, installedModules].map(async (store) => {
            const names = await listPackageNames(store);
            return names.map((name) => [store, name] as const);
        }),
    );
    const links = [[installedModules, '.bun'] as const, [testModules, '.bin'] as const, ...packages.flat()];
    for (const [store, name] of links) {
        const destination = join(target, name);
        if (await isOnDisk(destination)) continue;
        await mkdir(dirname(destination), { recursive: true });
        const original = await realpath(join(store, name));
        await symlink(original, destination, kind);
    }
}
/**
 * Link declared packages and the installed packages they depend on, so a scratch copy of node_modules holds only those.
 * A test package wins over a workspace package of the same name, as in linkInstalledModules.
 *
 * @param target the node_modules folder to create.
 * @param names packages that the sandbox project declares.
 */
async function linkPackages(target: string, names: readonly string[]): Promise<void> {
    const kind = isWindows ? 'junction' : 'dir';
    const pending = await Promise.all(
        names.map(
            async (name) =>
                [name, join((await isOnDisk(join(testModules, name))) ? testModules : installedModules, name)] as const,
        ),
    );
    const found = new Map<string, string>();
    for (let entry = pending.pop(); entry !== undefined; entry = pending.pop()) {
        const [name, path] = entry;
        if (found.has(name) || !(await isOnDisk(path))) continue;
        const real = await realpath(path);
        found.set(name, real);
        const manifest = JSON.parse(await readFile(join(real, 'package.json'), 'utf8')) as PackageJson;
        // The store keeps each dependency of a package beside it, in the same node_modules folder.
        const folder = join(real, ...name.split('/').map(() => '..'));
        const dependencies = {
            ...manifest.dependencies,
            ...manifest.optionalDependencies,
            ...manifest.peerDependencies,
        };
        for (const dependency of Object.keys(dependencies)) pending.push([dependency, join(folder, dependency)]);
    }
    for (const [name, real] of found) {
        const destination = join(target, name);
        await mkdir(dirname(destination), { recursive: true });
        await symlink(real, destination, kind);
    }
}

export { testModules, linkPackages, installedModules, linkInstalledModules };

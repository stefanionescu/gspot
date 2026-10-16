// Links installed npm packages into test projects.
import { join, dirname } from 'node:path';
import { isOnDisk } from '#tests/setup/files.ts';
import { isWindows } from '#tests/setup/system.ts';
import { mkdir, readdir, symlink, realpath } from 'node:fs/promises';

/** The installed workspace store keeps each package beside its own dependencies. */
const installedModules = join(import.meta.dir, '../../node_modules');

/** The tests package owns its isolated executable and package links. */
const testModules = join(import.meta.dir, '../node_modules');

/**
 * List installed packages, including names in scoped folders.
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
 * Canonical package links preserve relative dependencies that Windows store junctions break.
 * Copied sandboxes retain the installed dependency layout.
 * @param target the node_modules directory to create.
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
export { testModules, installedModules, linkInstalledModules };

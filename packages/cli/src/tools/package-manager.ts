import { z } from 'zod';
import semver from 'semver';
import { dirname, join } from 'node:path';
import { detectPackageManager } from 'nypm';
import { runToolCommand } from '#cli/tools/command.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { readPackageManifest } from '#cli/repository/manifests.ts';

/**
 * Validate an exact package-manager identity at the manifest boundary.
 * @param value the packageManager declaration
 */
export function parsePackageManager(value: string): z.infer<typeof packageManagerSchema> {
    const [name, version, ...extra] = value.split('@');
    if (extra.length > 0) throw new Error('Invalid packageManager declaration.');
    return packageManagerSchema.parse({ name, version });
}

/**
 * Observe the repository manager and retain the version recorded for its isolated tool project.
 * @param root
 * @param projectPaths
 */
export async function toolPackageManager(
    root: string,
    projectPaths: string[],
): Promise<z.infer<typeof packageManagerSchema>> {
    const files = openConfinedRoot(root);
    try {
        const options = { ignoreArgv: true, includeParentDirs: false };
        const detect = async (path: string) => {
            if (files.read(path) !== undefined) readPackageManifest(root, path);
            return detectPackageManager(join(root, dirname(path)), options);
        };
        let detected = await detect('package.json');
        if (detected === undefined) {
            const first = projectPaths
                .filter((path) => path.endsWith('/package.json') && !path.startsWith('.gspot/'))
                .sort()[0];
            if (first !== undefined) detected = await detect(first);
        }
        const name = detected?.name ?? (Bun.which('bun') === null ? 'npm' : 'bun');
        if (detected?.version !== undefined) return packageManagerSchema.parse({ name, version: detected.version });
        const current = files.read('.gspot/package.json');
        if (current !== undefined) {
            const held = z.object({ packageManager: z.string() }).parse(JSON.parse(current.bytes.toString('utf8')));
            const recorded = parsePackageManager(held.packageManager);
            if (recorded.name === name) return recorded;
        }
        const result = await runToolCommand(undefined, [name, '--version'], { cwd: root });
        if (result.code !== 0) throw new Error(`Cannot determine the ${name} version for the tool project.`);
        return packageManagerSchema.parse({ name, version: result.stdout.trim() });
    } finally {
        files.close();
    }
}

export const packageManagerSchema = z.strictObject({
    name: z.enum(['npm', 'bun', 'pnpm', 'yarn']),
    version: z.string().refine((value) => semver.valid(value) !== null, 'Package manager version must be exact.'),
});

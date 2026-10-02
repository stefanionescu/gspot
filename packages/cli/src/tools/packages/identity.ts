import { z } from 'zod';
import which from 'which';
import semver from 'semver';
import { join, dirname } from 'node:path';
import { detectPackageManager } from 'nypm';
import type { Root } from '#cli/types/platform.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { runToolCommand } from '#cli/tools/command.ts';
import { readPackageManifest } from '#cli/repository/packages.ts';

// The first package manager a candidate manifest declares, reading each manifest that exists on the way.
async function detectedTool(
    root: string,
    files: Root,
    candidates: string[],
): Promise<Awaited<ReturnType<typeof detectPackageManager>>> {
    for (const path of candidates) {
        if (files.read(path) !== undefined) readPackageManifest(root, path);
        const detected = await detectPackageManager(join(root, dirname(path)), {
            ignoreArgv: true,
            includeParentDirs: false,
        });
        if (detected !== undefined) return detected;
    }
    return undefined;
}

/**
 * Validate an exact package-manager identity at the manifest boundary.
 * @param value the packageManager declaration
 * @returns the manager name and exact version
 */
export function parsePackageTool(value: string): z.infer<typeof packageToolSchema> {
    const [name, version, ...extra] = value.split('@');
    if (extra.length > 0) throw new Error('Invalid packageManager declaration.');
    return packageToolSchema.parse({ name, version });
}

/**
 * Read the repository manager and retain the version recorded for its isolated tool project.
 * @param root the repository root
 * @param projectPaths the package manifests of the repository
 * @returns the package manager name and exact version
 */
export async function packageTool(root: string, projectPaths: string[]): Promise<z.infer<typeof packageToolSchema>> {
    const files = openRoot(root);
    try {
        const candidates = [
            'package.json',
            ...projectPaths
                .filter((path) => path.endsWith('/package.json') && !path.startsWith('.gspot/'))
                .toSorted((left, right) => left.localeCompare(right))
                .slice(0, 1),
        ];
        const detected = await detectedTool(root, files, candidates);
        const { name, version } = detected ?? {
            name: which.sync('bun', { nothrow: true }) === null ? 'npm' : 'bun',
            version: undefined,
        };
        if (version !== undefined) return packageToolSchema.parse({ name, version });
        const current = files.read('.gspot/package.json');
        if (current !== undefined) {
            const held = z.object({ packageManager: z.string() }).parse(JSON.parse(current.bytes.toString('utf8')));
            const recorded = parsePackageTool(held.packageManager);
            if (recorded.name === name) return recorded;
        }
        const result = await runToolCommand(undefined, [name, '--version'], { cwd: root });
        if (result.code !== 0) throw new Error(`Cannot determine the ${name} version for the tool project.`);
        return packageToolSchema.parse({ name, version: result.stdout.trim() });
    } finally {
        files.close();
    }
}

export const packageToolSchema = z.strictObject({
    name: z.enum(['npm', 'bun', 'pnpm', 'yarn']),
    version: z.string().refine((value) => semver.valid(value) !== null, 'Package manager version must be exact.'),
});

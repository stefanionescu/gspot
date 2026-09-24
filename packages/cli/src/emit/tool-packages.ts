import { detectPackageManager } from 'nypm';
import { readPackageManifest } from '#cli/repository/manifests.ts';
import semver from 'semver';
import { z } from 'zod';
import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import { dirname, join } from 'node:path';
import { runToolCommand } from '#cli/run/tool-runner.ts';
import { npmPins } from '#cli/emit/runner-tasks.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import type { Session } from '#cli/types/execution.ts';
import type { GeneratedFile } from '#cli/types/generation.ts';

export const packageManagerSchema = z.strictObject({
    name: z.enum(['npm', 'bun', 'pnpm', 'yarn']),
    version: z.string().refine((value) => semver.valid(value) !== null, 'Package manager version must be exact.'),
});

export function parsePackageManager(value: string): z.infer<typeof packageManagerSchema> {
    const [name, version, ...extra] = value.split('@');
    if (extra.length > 0) throw new Error('Invalid packageManager declaration.');
    return packageManagerSchema.parse({ name, version });
}

/** Observe the repository manager and retain the version recorded for its isolated tool project. */
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

/** Generate the npm tools as a private project without adding dependencies to the repository. */
export function toolPackages(session: Session): GeneratedFile[] {
    if (session.packageManager === undefined) return [];
    const manager = packageManagerSchema.parse(session.packageManager);
    const files: GeneratedFile[] = [
        {
            path: '.gspot/package.json',
            content: `${JSON.stringify(
                {
                    name: 'gspot-tools',
                    private: true,
                    type: 'module',
                    packageManager: `${manager.name}@${manager.version}`,
                    devDependencies: npmPins(everyManifest(session), session.policyFiles.policy.runner?.tool),
                },
                null,
                4,
            )}\n`,
            readOnly: true,
            kind: 'config',
        },
    ];
    if (manager.name === 'yarn' && semver.major(manager.version) >= 2)
        files.push({
            path: '.gspot/.yarnrc.yml',
            content: 'nodeLinker: node-modules\nenableGlobalCache: true\n',
            readOnly: true,
            kind: 'config',
        });
    return files;
}

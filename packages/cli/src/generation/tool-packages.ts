import semver from 'semver';
import { npmPins } from '#cli/tools/pins.ts';
import type { GeneratedFile } from '#cli/lifecycle/apply.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';
import type { ToolPackageManager } from '#cli/tools/packages/manager.ts';

const JSON_INDENT = 4;

/**
 * Generate the npm tools as a private project without adding dependencies to the repository.
 * @param manifests the selected manifests
 * @param manager the package manager the repository uses, or undefined without one
 * @param runner the task runner the policy names, or undefined
 * @returns the private project's files, or none without a package manager
 */
export function toolPackages(
    manifests: Manifest[],
    manager: ToolPackageManager | undefined,
    runner: string | undefined,
): GeneratedFile[] {
    if (manager === undefined) return [];
    const files: GeneratedFile[] = [
        {
            path: '.gspot/package.json',
            content: `${JSON.stringify(
                {
                    name: 'gspot-tools',
                    private: true,
                    type: 'module',
                    packageManager: `${manager.name}@${manager.version}`,
                    devDependencies: npmPins(manifests, runner),
                },
                null,
                JSON_INDENT,
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

import semver from 'semver';
import { npmPins } from '#cli/tools/pins.ts';
import { TOOLS_PROJECT } from '#cli/config/tools/tools.ts';
import type { PackageTool } from '#cli/types/tools/packages.ts';
import { YARN_BERRY_MAJOR } from '#cli/config/tools/packages.ts';
import type { Manifest, GeneratedFile } from '#cli/types/kits.ts';
import { PACKAGE_JSON_INDENT } from '#cli/config/generation/generation.ts';

/**
 * Generate the npm tools as a private project without adding dependencies to the repository.
 * @param manifests the selected manifests.
 * @param client the package manager the repository uses, or undefined without one.
 * @param runner the task runner the policy names, or undefined.
 * @returns the private project's files, or none without a package manager.
 */
export function toolPackages(
    manifests: Manifest[],
    client: PackageTool | undefined,
    runner: string | undefined,
): GeneratedFile[] {
    if (client === undefined) return [];
    const files: GeneratedFile[] = [
        {
            path: '.gspot/package.json',
            content: `${JSON.stringify(
                {
                    name: TOOLS_PROJECT,
                    private: true,
                    type: 'module',
                    packageManager: `${client.name}@${client.version}`,
                    devDependencies: npmPins(manifests, runner),
                },
                null,
                PACKAGE_JSON_INDENT,
            )}\n`,
            readOnly: true,
            kind: 'config',
        },
    ];
    if (client.name === 'yarn' && semver.major(client.version) >= YARN_BERRY_MAJOR)
        files.push({
            path: '.gspot/.yarnrc.yml',
            content: 'nodeLinker: node-modules\nenableGlobalCache: true\n',
            readOnly: true,
            kind: 'config',
        });
    return files;
}

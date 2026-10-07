import { npmPins } from '#cli/configurations/pins.ts';
import { isYarnBerry } from '#cli/parsers/packages.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { NPM_TOOL_PROJECT } from '#cli/config/parsers/packages.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import type { PackageInstaller } from '#cli/types/parsers/packages.ts';
import { YARN_SETTINGS, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';
import { JSON_INDENT, YARN_TOOL_PROJECT_SETTINGS } from '#cli/config/generation/templates.ts';

/**
 * Generate the npm tools as a tool project without adding dependencies to the repository.
 * @param manifests the selected manifests.
 * @param installer the package manager the repository uses, or undefined without one.
 * @param runner the task runner the policy names, or undefined.
 * @returns the tool project's files, or none without a package manager.
 */
export function npmProject(
    manifests: Manifest[],
    installer: PackageInstaller | undefined,
    runner: string | undefined,
): GeneratedFile[] {
    if (installer === undefined) return [];
    const files: GeneratedFile[] = [
        {
            path: TOOL_PACKAGE_PROJECT,
            content: `${JSON.stringify(
                {
                    ...NPM_TOOL_PROJECT,
                    packageManager: `${installer.name}@${installer.version}`,
                    devDependencies: npmPins(manifests, runner),
                },
                null,
                JSON_INDENT,
            )}\n`,
            readOnly: true,
            kind: 'config',
        },
    ];
    if (isYarnBerry(installer))
        files.push({
            path: YARN_SETTINGS,
            content: YARN_TOOL_PROJECT_SETTINGS,
            readOnly: true,
            kind: 'config',
        });
    return files;
}

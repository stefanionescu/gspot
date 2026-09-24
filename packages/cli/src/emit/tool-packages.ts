import semver from 'semver';
import type { Session } from '#cli/run/session.ts';
import type { GeneratedFile } from '#cli/emit/targets.ts';
import { npmPins } from '#cli/tools/tool-installation.ts';
import { everyManifest } from '#cli/configurations/select.ts';

/**
 * Generate the npm tools as a private project without adding dependencies to the repository.
 * @param session
 */
export function toolPackages(session: Session): GeneratedFile[] {
    if (session.packageManager === undefined) return [];
    const manager = session.packageManager;
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

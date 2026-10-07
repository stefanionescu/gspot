// The npm tool project's validated manifest and native manager behavior.
import { join } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import { SETUP } from '#cli/config/tools/install.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseToolProject } from '#cli/parsers/packages.ts';
import { lockfileMatches } from '#cli/tools/npm/lockfiles.ts';
import type { ToolProject } from '#cli/types/tools/project.ts';
import type { PackageToolProject } from '#cli/types/parsers/packages.ts';
import type { PackagePreparation, PackageInstallation } from '#cli/types/tools/npm.ts';
import { YARN_SETTINGS, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';

import {
    installArgv,
    lockfileArgv,
    assertPackageVersions,
    installPackageLockfile,
    preparePackageLockfile,
} from '#cli/tools/npm/install.ts';

/** The npm project's native commands and validations for the shared tool-project flow. */
export const packageToolProject: ToolProject<PackageToolProject, PackagePreparation, PackageInstallation> = {
    manifestPath: TOOL_PACKAGE_PROJECT,
    kind: 'npm',
    additionalPaths: [YARN_SETTINGS],
    lockPrefix: 'gspot-lockfile-',
    installPrefix: 'gspot-install-',
    parse: parseToolProject,
    lockfilePath: (project) => project.lockfilePath,
    matches: (project, recorded) =>
        recorded !== undefined && lockfileMatches(project.installer.name, recorded, project.dependencies),
    current: (project, recorded, manifest, owner) =>
        owner.read(TOOL_PACKAGE_PROJECT)?.bytes.equals(Buffer.from(manifest)) === true &&
        recorded !== undefined &&
        lockfileMatches(project.installer.name, recorded, project.dependencies)
            ? recorded
            : undefined,
    commands: (project) => ({
        installer: [],
        lockfile: [lockfileArgv(project.installer)],
        environment: [installArgv(project.installer)],
    }),
    createLockfile: async (work, { root, yarn }, recorded, project) => {
        if (yarn !== undefined) writeFileSync(join(work, '.yarnrc.yml'), yarn);
        if (recorded !== undefined && lockfileMatches(project.installer.name, recorded, project.dependencies))
            writeFileSync(join(work, project.lockfile), recorded);
        await preparePackageLockfile(root, work, project.installer);
        const lockfile = readFileSync(join(work, project.lockfile), 'utf8');
        if (!lockfileMatches(project.installer.name, lockfile, project.dependencies))
            throw new GspotError(
                'installation',
                `${project.installer.name} produced a mismatched tool lockfile. Existing files were preserved.`,
            );
        return lockfile;
    },
    install: async (work, { root, tools }, guards, project) => {
        await installPackageLockfile(root, work, project.installer);
        await assertPackageVersions(work, project.dependencies, tools);
        guards.scratch(`${project.installer.name} changed locked inputs. No installed files were written. ${SETUP}`);
        guards.source('Tool project inputs changed during installation. Retry the command.');
        return `installed locked npm tools under .gspot/node_modules with ${project.installer.name}@${project.installer.version}`;
    },
};

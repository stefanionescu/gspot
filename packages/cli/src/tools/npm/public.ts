import semver from 'semver';
import { join, dirname } from 'node:path';
import { detectPackageManager } from 'nypm';
import { readFileSync, writeFileSync } from 'node:fs';
import { openRoot } from '#cli/platform/root/public.ts';
import { locateCandidates } from '#cli/tools/contracts.ts';
import { NPM_REQUIRES } from '#cli/config/configurations.ts';
import type { ToolProject } from '#cli/types/tools/project.ts';
import { GspotError, runBlocking } from '#cli/platform/public.ts';
import { readPackageManifest } from '#cli/repository/contracts.ts';
import { SETUP, VERSION_TIMEOUT_MS } from '#cli/config/tools/install.ts';
import { DOT_GSPOT, YARN_SETTINGS, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';
import type { PackageRun, PackagePreparation, PackageInstallation } from '#cli/types/tools/npm.ts';
import { lockfileMatches, stripBunRegistryUrls, stripYarnRegistryUrls } from '#cli/tools/npm/lockfiles.ts';
import { runPackageInstaller, assertPackageVersions, packageInstallerCommands } from '#cli/tools/npm/contracts.ts';
import type { PackageInstaller, PackageToolProject, PackageInstallerIdentity } from '#cli/types/parsers/packages.ts';

import {
    isYarnBerry,
    packageLockfile,
    parseToolProject,
    packageManifestSchema,
    parsePackageInstaller,
    packageInstallerSchema,
    declaredPackageInstaller,
    packageInstallerIdentitySchema,
    packageInstallerDeclarationSchema,
} from '#cli/parsers/packages/contracts.ts';

// The first package manager a candidate manifest declares, reading each manifest that exists on the way.
async function detectedInstaller(root: string, candidates: string[]) {
    for (const path of candidates) {
        const manifest = readPackageManifest(root, path);
        const declared = manifest === undefined ? undefined : declaredPackageInstaller(manifest);
        if (declared !== undefined) return declared;
        const detected = await detectPackageManager(join(root, dirname(path)), {
            ignoreArgv: true,
            ignorePackageJSON: true,
            includeParentDirs: false,
        });
        if (detected !== undefined)
            return packageInstallerDeclarationSchema.parse({ name: detected.name, version: detected.version });
    }
    return undefined;
}

// The manager the tool project recorded, or undefined when the file does not parse, as when a merge left its markers.
function recordedInstaller(bytes: Buffer): PackageInstaller | undefined {
    let held: unknown;
    try {
        held = JSON.parse(bytes.toString('utf8'));
    } catch {
        return undefined;
    }
    const parsed = packageManifestSchema.safeParse(held);
    if (!parsed.success || parsed.data.packageManager === undefined) return undefined;
    return parsePackageInstaller(parsed.data.packageManager);
}

// Private registry routing stays in the installation environment, out of portable lockfiles.
function stripRegistryUrls(work: string, installer: PackageInstaller, { env, lockfile }: PackageRun): void {
    const lockfilePath = join(work, packageLockfile(installer.name));
    if (installer.name === 'bun') writeFileSync(lockfilePath, stripBunRegistryUrls(lockfile, env));
    if (installer.name !== 'yarn' || isYarnBerry(installer)) return;
    const registry = env['npm_config_registry'];
    if (registry === undefined) throw new Error('A Yarn 1 lockfile needs npm_config_registry to relocate its URLs.');
    writeFileSync(lockfilePath, stripYarnRegistryUrls(lockfile, registry));
}

/** The npm project's native commands and validations for the shared tool-project flow. */
export const packageToolProject: ToolProject<PackageToolProject, PackagePreparation, PackageInstallation> = {
    manifestPath: TOOL_PACKAGE_PROJECT,
    kind: 'npm',
    additionalPaths: [YARN_SETTINGS],
    lockfilePrefix: 'gspot-lockfile-',
    installPrefix: 'gspot-install-',
    parse: parseToolProject,
    lockfilePath: (project) => project.lockfilePath,
    matches: (project, recorded) =>
        recorded !== undefined && lockfileMatches(project.installer.name, recorded, project.dependencies),
    current: (project, recorded, manifest, owner, { root }) => {
        if (
            owner.read(TOOL_PACKAGE_PROJECT)?.bytes.equals(Buffer.from(manifest)) === true &&
            recorded !== undefined &&
            packageToolProject.matches(project, recorded)
        )
            return recorded;
        if (locateCandidates(root, NPM_REQUIRES[0], { searchFolders: [root] }).length === 0)
            throw new GspotError(
                'tool',
                'node is required by the npm tool project. Install it before resolving its lockfile.',
            );
        return undefined;
    },
    commands: (project) => {
        const { lockfile, install } = packageInstallerCommands(project.installer);
        return { installer: [], lockfile: [lockfile], environment: [install] };
    },
    createLockfile: async (work, { root, yarn }, recorded, project) => {
        if (yarn !== undefined) writeFileSync(join(work, '.yarnrc.yml'), yarn);
        if (recorded !== undefined && packageToolProject.matches(project, recorded))
            writeFileSync(join(work, project.lockfile), recorded);
        const env = await runPackageInstaller(
            root,
            work,
            project.installer,
            packageInstallerCommands(project.installer).lockfile,
            'lockfile resolution failed',
        );
        stripRegistryUrls(work, project.installer, env);
        const lockfile = readFileSync(join(work, project.lockfile), 'utf8');
        if (!packageToolProject.matches(project, lockfile))
            throw new GspotError(
                'installation',
                `${project.installer.name} produced a mismatched tool lockfile. Existing files were preserved.`,
            );
        return lockfile;
    },
    install: async (work, { root, tools }, guards, project) => {
        await runPackageInstaller(
            root,
            work,
            project.installer,
            packageInstallerCommands(project.installer).install,
            'immutable installation failed',
        );
        guards.source('Tool project inputs changed during installation. Retry the command.');
        await assertPackageVersions(work, project.dependencies, tools);
        guards.scratch(`${project.installer.name} changed locked inputs. No installed files were written. ${SETUP}`);
        guards.source('Tool project inputs changed during installation. Retry the command.');
        return `installed locked npm tools under .gspot/node_modules with ${project.installer.name}@${project.installer.version}`;
    },
};

/**
 * Read the repository manager and retain the version recorded for its isolated tool project.
 * @param root the repository root
 * @param trackedPaths the source paths inventoried in the repository
 * @returns the manager name and its declared or recorded version, when present
 */
export async function selectPackageInstaller(root: string, trackedPaths: string[]): Promise<PackageInstallerIdentity> {
    using files = openRoot(root);
    // The root declaration wins; without it, the first nested manifest provides a deterministic shared tool manager.
    const candidates = [
        'package.json',
        ...trackedPaths
            .filter((path) => path.endsWith('/package.json') && !path.startsWith(`${DOT_GSPOT}/`))
            .toSorted((left, right) => left.localeCompare(right))
            .slice(0, 1),
    ];
    const { name, version } = (await detectedInstaller(root, candidates)) ?? { name: 'npm', version: undefined };
    if (version !== undefined) {
        if (semver.valid(version) === null)
            throw new GspotError(
                'installation',
                `The tool project needs an exact ${name} version, such as ${name}@1.2.3, and package.json declares ${version}. Write an exact packageManager version.`,
            );
        return packageInstallerSchema.parse({ name, version });
    }
    const current = files.read(TOOL_PACKAGE_PROJECT);
    const recorded = current === undefined ? undefined : recordedInstaller(current.bytes);
    if (recorded?.name === name) return recorded;
    return packageInstallerIdentitySchema.parse({ name });
}

/**
 * Resolve an undeclared package manager version only when generating or installing a tool project.
 * @param root the repository root
 * @param installer the declared or detected package manager identity
 * @returns the name and version requirement used by the tool project
 */
export function inspectPackageInstaller(root: string, installer: PackageInstallerIdentity): PackageInstaller {
    const { name, version } = installer;
    if (version !== undefined) return { name, version };
    const result = runBlocking([name, '--version'], { cwd: root, timeoutMs: VERSION_TIMEOUT_MS });
    if (result.code !== 0) throw new GspotError('tool', `Cannot determine the ${name} version for the tool project.`);
    return packageInstallerSchema.parse({ name, version: result.stdout.trim() });
}

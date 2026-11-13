import semver from 'semver';

import { CI_NODE } from '#cli/config/repository/version-pin.ts';
import { TRAILING_PERIOD } from '#cli/config/settings/validation.ts';
import { PACKAGE_MANAGER_UPGRADES, RELEASE_AGE_VERSIONS } from '#cli/config/tools/installers.ts';
import { VERSION_FLAG } from '#cli/config/tools/programs.ts';
import { buildPackageManagerCommand, selectToolPackageManager } from '#cli/repository/projects/package-manager.ts';
import { packageManagerSchema } from '#cli/schemas/repository.ts';
import { GspotError } from '#cli/system/errors.ts';
import { runProcess } from '#cli/system/processes/run.ts';
import { runInstallStep } from '#cli/tools/installers/steps.ts';
import type { PackageManagerCommand } from '#cli/types/repository.ts';
import type { Session, ToolInstall, ToolPackageManager } from '#cli/types/tools.ts';

/**
Read the package manager of the tool project and its version. A session without npm tools has none. A pin gives the
version, and without a pin the package manager prints it.
*/
export async function readToolPackageManager(session: Session): Promise<ToolPackageManager | undefined> {
    const pin = session.packageManager;
    if (pin === undefined) return undefined;
    const name = selectToolPackageManager(pin.name);
    const command: PackageManagerCommand = name === pin.name ? pin : { name };
    if (command.version !== undefined) return { name, version: command.version, command };
    const result = await runProcess([name, VERSION_FLAG], {
        cwd: session.toolsRoot,
        timeoutSeconds: session.settings.tool_timeout_seconds,
    });
    if (result.code !== 0)
        throw new GspotError(
            'install',
            `Cannot determine the ${name} version for the tool project. Check that ${name} --version runs in the repository, then run the command again.`,
        );
    const parsed = packageManagerSchema.safeParse({ name, version: result.stdout.trim() });
    if (!parsed.success)
        throw new GspotError(
            'install',
            `Cannot read the ${name} version for the tool project. Check that ${name} --version prints a version.`,
            { cause: parsed.error },
        );
    return { ...parsed.data, name, command };
}

/**
Verify the package manager executable before install changes any tool project file.
*/
export async function assertPackageManagerVersion(install: ToolInstall): Promise<void> {
    const { session, packageManager } = install;
    if (packageManager === undefined) return;
    const versionCommand = buildPackageManagerCommand(packageManager.command, [VERSION_FLAG], CI_NODE);
    const version = await runInstallStep(install, versionCommand, { cwd: session.root });
    const requirement = `${String(semver.major(packageManager.version))}.x`;
    const found = version.stdout.trim();
    if (version.code === 0 && semver.satisfies(found, requirement, { includePrerelease: true })) {
        const minimum = RELEASE_AGE_VERSIONS[packageManager.name];
        if (semver.lt(found, minimum)) {
            const fix =
                packageManager.command.version === undefined
                    ? `Run ${PACKAGE_MANAGER_UPGRADES[packageManager.name]}.`
                    : `Change the ${packageManager.name} version that package.json pins.`;
            throw new GspotError(
                'install',
                `gspot needs ${packageManager.name} ${minimum} or later, which holds back new releases for dependencies.min_release_age_days. Found ${found}. ${fix}`,
            );
        }
        return;
    }
    const result =
        version.code === 0
            ? `found ${found}`
            : `\`${packageManager.name} ${VERSION_FLAG}\` exited with ${String(version.code)}: ${version.stderr.trim().replace(TRAILING_PERIOD, '')}`;
    throw new GspotError(
        'tool',
        `The tool project requires ${packageManager.name}@${requirement}, and ${result}. Install that package manager version first.`,
    );
}

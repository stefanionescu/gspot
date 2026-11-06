import semver from 'semver';

import cliPackage from '#cli-package' with { type: 'json' };
import {
    FROZEN_INSTALLS,
    LOCKFILES,
    MISE_NODE_PIN_COMMAND,
    PACKAGE_MANAGER_LABELS,
    START_RUNNERS,
    YARN_BERRY_INSTALL,
    YARN_BERRY_MAJOR,
} from '#cli/config/repository/javascript.ts';
import type { SetupReference } from '#cli/types/repository.ts';

export function buildFrozenInstallArguments(
    lockfile: keyof typeof FROZEN_INSTALLS,
    version: string | undefined,
): readonly string[] {
    const command = FROZEN_INSTALLS[lockfile];
    const isYarnBerry = command[0] === 'yarn' && version !== undefined && semver.major(version) >= YARN_BERRY_MAJOR;
    return (isYarnBerry ? YARN_BERRY_INSTALL : command).slice(1);
}

export function buildSetupReference(): SetupReference[] {
    return Object.entries(PACKAGE_MANAGER_LABELS).map(([name, label]) => {
        const runner = START_RUNNERS[name as keyof typeof START_RUNNERS];
        const lockfile = LOCKFILES.find((file) => file.packageManager === name && 'copied' in file)?.file;
        const prerequisites = name === 'mise' ? [MISE_NODE_PIN_COMMAND] : [];
        const add = runner.installCommand.replace('<package>@<version>', () => cliPackage.name);
        const frozen =
            lockfile === undefined
                ? []
                : [
                      name,
                      ...buildFrozenInstallArguments(
                          lockfile as keyof typeof FROZEN_INSTALLS,
                          String(YARN_BERRY_MAJOR) + '.0.0',
                      ),
                  ];
        return {
            name,
            label,
            start: runner.command,
            add,
            prerequisites,
            lines: [...prerequisites, add, `${runner.command} init`],
            clone: [
                ...(frozen.length === 0 ? [] : [frozen.join(' ')]),
                `${runner.command} install`,
                `${runner.command} check`,
            ],
        };
    });
}

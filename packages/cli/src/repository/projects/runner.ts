import { existsSync } from 'node:fs';
import { join } from 'node:path';

import cliPackage from '#cli-package' with { type: 'json' };
import { LOCKFILES, PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import {
    type FROZEN_INSTALLS,
    MISE_NODE_PIN_COMMAND,
    PACKAGE_MANAGER_LABELS,
    PNPM_WORKSPACE_FILE,
    PNPM_WORKSPACE_INSTALL,
    START_RUNNERS,
    YARN_BERRY_MAJOR,
} from '#cli/config/repository/projects.ts';
import { readPackageJson } from '#cli/parsers/projects/dependencies.ts';
import { buildFrozenInstallArguments, detectPackageManager } from '#cli/repository/projects/package-manager.ts';
import type { SetupReference, StartRunner } from '#cli/types/repository.ts';

export function readCliSpecifier(root: string): string | undefined {
    const { name } = cliPackage;
    const manifest = readPackageJson(root, PACKAGE_JSON);
    return manifest?.devDependencies?.[name] ?? manifest?.dependencies?.[name];
}

/**
Select the command that adds a package. pnpm refuses a plain add in the folder that holds its workspace file.
*/
export function selectInstallCommand(name: StartRunner['name'], folder: string): string {
    return name === 'pnpm' && existsSync(join(folder, PNPM_WORKSPACE_FILE))
        ? PNPM_WORKSPACE_INSTALL
        : START_RUNNERS[name].installCommand;
}

export function buildStartRunner(name: StartRunner['name'], root: string): StartRunner {
    const installCommand = selectInstallCommand(name, root).replace('<package>', () => cliPackage.name);
    return { name, ...START_RUNNERS[name], installCommand };
}

export function selectStartRunner(root: string): StartRunner {
    const name = readCliSpecifier(root) === undefined ? 'mise' : detectPackageManager(root, []).name;
    return buildStartRunner(name, root);
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
                          `${String(YARN_BERRY_MAJOR)}.0.0`,
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

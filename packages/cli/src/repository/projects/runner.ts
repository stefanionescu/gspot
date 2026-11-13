import { existsSync } from 'node:fs';
import { join } from 'node:path';

import cliPackage from '#cli-package' with { type: 'json' };
import { MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { LOCKFILES, PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import {
    type FROZEN_INSTALLS,
    PNPM_WORKSPACE_FILE,
    YARN_BERRY_MAJOR,
} from '#cli/config/repository/package-managers.ts';
import {
    MISE_NODE_PIN_COMMAND,
    NODE_TOOL,
    PACKAGE_MANAGER_LABELS,
    PNPM_WORKSPACE_INSTALL,
    START_RUNNERS,
} from '#cli/config/repository/version-pin.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { readPackageJson } from '#cli/parsers/projects/dependencies.ts';
import { buildFrozenInstallArguments, detectPackageManager } from '#cli/repository/projects/package-manager.ts';
import { miseToolsSchema } from '#cli/schemas/repository.ts';
import { findText } from '#cli/system/files/reads.ts';
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

/**
List the commands that a mise pin needs before it. Without a Node.js pin, mise starts gspot with the Node.js of the
system, which can be too old to run it.
*/
export function listPinPrerequisites(root: string, runner: StartRunner['name']): string[] {
    if (runner !== 'mise') return [];
    const { tools } = parseTomlFile(MISE_CONFIG_FILE, findText(root, MISE_CONFIG_FILE) ?? '', miseToolsSchema);
    return tools[NODE_TOOL] === undefined ? [MISE_NODE_PIN_COMMAND] : [];
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

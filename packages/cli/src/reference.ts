import { buildProgram } from '#cli/main.ts';
import { findPackagePin } from '#cli/tools/pins.ts';
import { compareText } from '#cli/system/text/order.ts';
import { describeCheck } from '#cli/engine/reference.ts';
import { listChecksById } from '#cli/manifests/checks.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { GROUP_LABELS } from '#cli/config/commands/setup.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { MINIMUM_NODE_VERSION } from '#cli/system/package/runtime.ts';
import { RELEASE_AGE_VERSIONS } from '#cli/config/tools/installers.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { GLOBAL_OPTIONS, PROGRAM_EXIT_CODES } from '#cli/config/main.ts';
import { buildSetupReference } from '#cli/repository/projects/runner.ts';
import { HOOK_PROGRAM_MISSING } from '#cli/config/generation/builders.ts';
import { LEVEL_SUMMARY, ALL_LEVEL_SUMMARY } from '#cli/config/settings/file.ts';
import { buildJsonSchema, buildSettingsReference } from '#cli/settings/reference.ts';
import { FROZEN_INSTALLS, YARN_BERRY_INSTALL } from '#cli/config/repository/projects.ts';
import { listRuleReferences, formatDetectionConditions } from '#cli/manifests/reference.ts';
import type { CliReference, CommandReference, ConfigurationReference } from '#cli/types/main.ts';

// The docs site imports the CLI only through this file. package.json names it in `exports` under the condition
// `gspot-source`, which only this repository sets, because the published package holds no source.
export { DOCS_PATHS } from '#cli/config/manifests.ts';
export { compareText } from '#cli/system/text/order.ts';
export { formatNameList } from '#cli/system/text/messages.ts';
export type { CliReference, CommandReference } from '#cli/types/main.ts';

function buildCommandReference(command: ReturnType<typeof buildProgram>['commands'][number]): CommandReference {
    const help = COMMAND_HELP[command.name() as keyof typeof COMMAND_HELP];
    return {
        name: command.name(),
        summary: command.summary(),
        description: command.description(),
        usage: `gspot ${command.name()} ${command.usage()}`.trim(),
        arguments: command.registeredArguments.map((argument) => ({
            name: argument.name(),
            description: argument.description,
            required: argument.required,
            ...(argument.argChoices !== undefined && { choices: argument.argChoices }),
            ...(argument.defaultValue !== undefined && { default: argument.defaultValue as unknown }),
        })),
        options: command
            .createHelp()
            .visibleOptions(command)
            .map((option) => ({
                flags: option.flags,
                description: option.description,
                ...(option.argChoices !== undefined && { choices: option.argChoices }),
                ...(option.defaultValue !== undefined && { default: option.defaultValue as unknown }),
            })),
        exitCodes: help.exitCodes,
        example: help.example,
    };
}

function buildConfigurationsReference(shipped: Configuration[]): ConfigurationReference[] {
    return shipped.map((configuration) => ({
        ...configuration,
        selection: {
            ...formatDetectionConditions(configuration.detect),
            requiredBy: shipped.filter((owner) => owner.requires.includes(configuration.name)).map(({ name }) => name),
        },
        settings: SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? [],
        ruleFiles: listRuleReferences(configuration),
        installedTools: configuration.tools.map((tool) => ({
            name: tool.name,
            version: tool.version,
            source:
                findPackagePin(tool)?.kind ??
                (tool.system === true || tool.installers.mise === undefined ? 'system' : 'mise'),
        })),
    }));
}

/**
Read the public facts that the documentation shows. This opens no repository and starts no tool.
*/
function readCliReference(): CliReference {
    const shipped = readConfigurations()
        .values()
        .toArray()
        .toSorted((left, right) => compareText(left.name, right.name));
    const configurations = buildConfigurationsReference(shipped);
    const checks = listChecksById(configurations)
        .values()
        .map(({ check, configuration }) => {
            const explanations = selectCheckCode(check)?.explanations;
            return { check, configuration, ...describeCheck(check, configurations, explanations), explanations };
        })
        .toArray();
    const minimumLevelTools = new Set(
        checks.filter(({ check }) => check.level === 'basic').flatMap(({ tools }) => tools),
    );
    return {
        groups: GROUP_LABELS,
        commands: buildProgram(async () => {}).commands.map((command) => buildCommandReference(command)),
        globalOptions: GLOBAL_OPTIONS,
        exitCodes: PROGRAM_EXIT_CODES,
        configurations,
        checks,
        settings: buildSettingsReference(configurations),
        schema: buildJsonSchema(),
        setup: buildSetupReference(),
        hookProgramMissing: HOOK_PROGRAM_MISSING,
        runtimeMinimums: { node: MINIMUM_NODE_VERSION },
        packageManagerMinimums: RELEASE_AGE_VERSIONS,
        levelSummaries: { basic: LEVEL_SUMMARY, all: ALL_LEVEL_SUMMARY },
        allLevelTools: [...new Set(checks.flatMap(({ tools }) => tools))]
            .filter((tool) => !minimumLevelTools.has(tool))
            .toSorted(compareText),
        yarnClassicInstall: FROZEN_INSTALLS['yarn.lock'].join(' '),
        cloneInstalls: [
            { lockfile: 'yarn.lock', note: 'Yarn 2 or later', command: YARN_BERRY_INSTALL.join(' ') },
            ...Object.entries(FROZEN_INSTALLS).map(([lockfile, command]) => ({
                lockfile,
                note: lockfile === 'yarn.lock' ? 'Yarn 1' : undefined,
                command: command.join(' '),
            })),
        ],
        suppressions: new Map(
            configurations.flatMap(({ tools }) =>
                tools.flatMap((tool) =>
                    tool.suppression === undefined
                        ? []
                        : [[tool.name, { name: tool.name, form: tool.suppression }] as const],
                ),
            ),
        )
            .values()
            .toArray(),
    };
}

export const CLI_REFERENCE = readCliReference();

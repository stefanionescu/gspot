import semver from 'semver';
import { buildProgram } from '#cli/main.ts';
import { findPackagePin } from '#cli/tools/pins.ts';
import { STAGE_FILTERS } from '#cli/config/engine.ts';
import { DOCS_PATHS } from '#cli/config/manifests.ts';
import { GROUP_LABELS } from '#cli/config/generation.ts';
import { describeCheck } from '#cli/engine/reference.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { buildJsonSchema } from '#cli/settings/editor-schema.ts';
import { compareText, quoteArgument } from '#cli/system/text.ts';
import { buildSettingsReference } from '#cli/settings/reference.ts';
import { RELEASE_AGE_VERSIONS } from '#cli/config/tools/installers.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { GLOBAL_OPTIONS, PROGRAM_EXIT_CODES } from '#cli/config/main.ts';
import { buildSetupReference } from '#cli/repository/javascript/setup.ts';
import { listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import { LEVEL_SUMMARY, ALL_LEVEL_SUMMARY } from '#cli/config/settings/schema.ts';
import type { CliReference, CheckReference, CommandReference } from '#cli/types/main.ts';
import { listRuleReferences, formatDetectionConditions } from '#cli/manifests/reference.ts';
import type { Configuration, ConfigurationCheck, ConfigurationReference } from '#cli/types/manifests.ts';
import { START_RUNNERS, FROZEN_INSTALLS, YARN_BERRY_INSTALL } from '#cli/config/repository/javascript.ts';

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
                (tool.system !== true && tool.installers['mise'] !== undefined ? 'mise' : 'system'),
        })),
    }));
}

function buildCheckReference(
    { check, configuration }: ConfigurationCheck,
    configurations: Configuration[],
): CheckReference {
    const description = describeCheck(check, configurations);
    const ruleDocs = CHECK_CODE[check.id]?.ruleDocs;
    if (ruleDocs === undefined) return { check, configuration, ...description, ruleDocs };
    const firstRule = Object.keys(ruleDocs)[0];
    return {
        check,
        configuration,
        ...description,
        ruleDocs,
        turnOff: {
            ...description.turnOff,
            rule:
                firstRule === undefined
                    ? description.turnOff.rule
                    : `gspot ignore ${quoteArgument(check.id)} --rule ${quoteArgument(firstRule)} --reason "<why>"`,
        },
    };
}

/**
Read the public facts that the documentation shows. This opens no repository and starts no tool.
*/
export function readCliReference(): CliReference {
    const shipped = readConfigurations()
        .values()
        .toArray()
        .toSorted((left, right) => compareText(left.name, right.name));
    const configurations = buildConfigurationsReference(shipped);
    const checks = listChecksById(configurations)
        .values()
        .map((reference) => buildCheckReference(reference, configurations))
        .toArray();
    const minimumLevelTools = new Set(
        checks.filter(({ check }) => check.level === 'basic').flatMap(({ tools }) => tools),
    );
    return {
        package: cliPackage,
        docs: DOCS_PATHS,
        groups: GROUP_LABELS,
        reportStages: STAGE_FILTERS,
        commands: buildProgram(() => {}).commands.map((command) => buildCommandReference(command)),
        globalOptions: GLOBAL_OPTIONS,
        exitCodes: PROGRAM_EXIT_CODES,
        configurations,
        checks,
        settings: buildSettingsReference(configurations),
        schema: buildJsonSchema(),
        setup: buildSetupReference(),
        runners: START_RUNNERS,
        runtimeMinimums: {
            node: semver.minVersion(cliPackage.engines.node)?.version as string,
            bun: semver.minVersion(cliPackage.engines.bun)?.version as string,
        },
        packageManagerMinimums: RELEASE_AGE_VERSIONS,
        levelSummaries: { basic: LEVEL_SUMMARY, all: ALL_LEVEL_SUMMARY },
        allLevelTools: [...new Set(checks.flatMap(({ tools }) => tools))]
            .filter((tool) => !minimumLevelTools.has(tool))
            .toSorted(compareText),
        yarnClassicInstall: FROZEN_INSTALLS['yarn.lock'].join(' '),
        cloneInstalls: [
            { lockfile: 'yarn.lock', note: 'Yarn 2 on', command: YARN_BERRY_INSTALL.join(' ') },
            ...Object.entries(FROZEN_INSTALLS).map(([lockfile, command]) => ({
                lockfile,
                note: lockfile === 'yarn.lock' ? 'Yarn 1' : undefined,
                command: command.join(' '),
            })),
        ],
        suppressions: [
            ...new Map(
                configurations.flatMap(({ tools }) =>
                    tools.flatMap((tool) =>
                        tool.suppression === undefined
                            ? []
                            : [[tool.name, { name: tool.name, form: tool.suppression }] as const],
                    ),
                ),
            ).values(),
        ],
    };
}

export const CLI_REFERENCE = readCliReference();

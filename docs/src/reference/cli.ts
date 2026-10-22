import { posix } from 'node:path';
import { buildProgram } from '#cli/main.ts';
import { isDeepStrictEqual } from 'node:util';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { buildJsonSchema } from '#cli/settings/json-schema.ts';
import { listSettings, buildKnownSettings } from '#cli/settings/known.ts';
import type { CliReference, SettingVariant, CommandReference } from '../types/reference.ts';
import { listRuleFiles, listChecksById, readConfigurations } from '#cli/configurations/manifests.ts';

function groupSettingVariants(configurations: CliReference['configurations']): SettingVariant[] {
    const settings = new Map<string, SettingVariant[]>();
    const ownedSettings = [
        ...[...buildKnownSettings([], 'recommended').settings.values()].map((setting) => ({
            setting,
            owner: 'gspot',
        })),
        ...configurations.flatMap((configuration) =>
            listSettings(configuration.name).map((setting) => ({
                setting,
                owner: configuration.name,
            })),
        ),
    ];
    for (const { setting, owner } of ownedSettings) {
        const variants = settings.get(setting.name) ?? [];
        const variant = variants.find((entry) =>
            isDeepStrictEqual(
                [entry.setting.default, entry.setting.default_all],
                [setting.default, setting.default_all],
            ),
        );
        if (variant === undefined) variants.push({ setting, owners: [owner] });
        else if (!variant.owners.includes(owner)) variant.owners.push(owner);
        settings.set(setting.name, variants);
    }
    return [...settings.values()]
        .flat()
        .toSorted((first, second) => first.setting.name.localeCompare(second.setting.name));
}

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
            ...(argument.argChoices === undefined ? {} : { choices: argument.argChoices }),
            ...(argument.defaultValue === undefined ? {} : { default: argument.defaultValue as unknown }),
        })),
        options: command
            .createHelp()
            .visibleOptions(command)
            .map((option) => ({
                flags: option.flags,
                description: option.description,
                ...(option.argChoices === undefined ? {} : { choices: option.argChoices }),
                ...(option.defaultValue === undefined ? {} : { default: option.defaultValue as unknown }),
            })),
        exitCodes: help.exitCodes,
        example: help.example,
    };
}

/**
 * Build the reference facts that the docs pages read.
 *
 * @returns the facts for the reference pages.
 */
export function readCliReference(): CliReference {
    const configurations = [...readConfigurations().values()].toSorted((first, second) =>
        first.name.localeCompare(second.name),
    );
    return {
        commands: buildProgram(() => {}).commands.map((command) => buildCommandReference(command)),
        configurations,
        checks: [...listChecksById(configurations).values()],
        settings: groupSettingVariants(configurations),
        schema: buildJsonSchema(),
        ruleFiles: Object.fromEntries(
            configurations.map((configuration) => [
                configuration.name,
                listRuleFiles(configuration).map(({ path }) => posix.join(GSPOT_PATHS.configurations, path)),
            ]),
        ),
        configurationSettings: Object.fromEntries(
            configurations.map((configuration) => [configuration.name, listSettings(configuration.name)]),
        ),
    };
}

export const CLI_REFERENCE = readCliReference();

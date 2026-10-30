import { buildProgram } from '#cli/main.ts';
import { isDeepStrictEqual } from 'node:util';
import { compareText } from '#cli/system/text.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { buildJsonSchema } from '#cli/settings/json-schema.ts';
import { listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import { buildAvailableSettings, SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import type { CliReference, SettingVariant, CommandReference } from '#docs/types/reference.ts';

function groupSettingVariants(configurations: CliReference['configurations']): SettingVariant[] {
    const settings = new Map<string, SettingVariant[]>();
    const ownedSettings = [
        ...buildAvailableSettings([], 'basic')
            .settings.values()
            .map((setting) => ({
                setting,
                owner: 'gspot',
            })),
        ...configurations.flatMap((configuration) =>
            (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []).map((setting) => ({
                setting,
                owner: configuration.name,
            })),
        ),
    ];
    for (const { setting, owner } of ownedSettings) {
        const variants = settings.get(setting.name) ?? [];
        const variant = variants.find((each) =>
            isDeepStrictEqual([each.setting.default, each.setting.default_all], [setting.default, setting.default_all]),
        );
        if (variant === undefined) variants.push({ setting, owners: [owner] });
        else if (!variant.owners.includes(owner)) variant.owners.push(owner);
        settings.set(setting.name, variants);
    }
    return settings
        .values()
        .toArray()
        .flat()
        .toSorted((first, second) => compareText(first.setting.name, second.setting.name));
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

function readCliReference(): CliReference {
    const configurations = readConfigurations()
        .values()
        .toArray()
        .toSorted((first, second) => compareText(first.name, second.name));
    return {
        commands: buildProgram(() => {}).commands.map((command) => buildCommandReference(command)),
        configurations,
        checks: listChecksById(configurations).values().toArray(),
        settings: groupSettingVariants(configurations),
        schema: buildJsonSchema(),
    };
}

export const CLI_REFERENCE = readCliReference();

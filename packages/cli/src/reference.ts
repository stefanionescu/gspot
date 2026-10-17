import { buildProgram } from '#cli/main.ts';
import { isDeepStrictEqual } from 'node:util';
import { SCHEMA_FILE } from '#cli/config/settings/file.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { GROUP_LABELS } from '#cli/config/configurations.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { buildJsonSchema } from '#cli/settings/schema/gspot-toml.ts';
import { buildKnownSettings, listConfigurationSettings } from '#cli/settings/known.ts';
import type { ReferenceData, SettingVariant, CommandReference } from '#cli/types/reference.ts';
import { readManifests, listRuleFiles, listChecksById } from '#cli/configurations/manifests.ts';

import {
    PURGECSS_EXTRACTOR,
    PURGECSS_TOKEN_END,
    PURGECSS_PSEUDO_CLASS_PATTERN,
} from '#cli/config/generation/tool-files.ts';

function groupSettingVariants(configurations: ReferenceData['configurations'], reads: ReadCache): SettingVariant[] {
    const settings = new Map<string, SettingVariant[]>();
    const declarations = [
        ...[...buildKnownSettings([], 'recommended', reads).declarations.values()].map((setting) => ({
            setting,
            owner: 'gspot',
        })),
        ...configurations.flatMap((manifest) =>
            listConfigurationSettings(manifest.configuration.name).map((setting) => ({
                setting,
                owner: manifest.configuration.name,
            })),
        ),
    ];
    for (const { setting, owner } of declarations) {
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
 * Read the CLI facts once for the documentation build.
 * @returns the data for the reference pages.
 */
export function readReferenceData(): ReferenceData {
    const reads = createReadCache(process.cwd());
    const configurations = [...readManifests(reads).values()].toSorted((first, second) =>
        first.configuration.name.localeCompare(second.configuration.name),
    );
    return {
        commands: buildProgram(() => {}).commands.map((command) => buildCommandReference(command)),
        configurations,
        checks: [...listChecksById(configurations).values()],
        settings: groupSettingVariants(configurations, reads),
        schema: buildJsonSchema(),
        schemaFile: SCHEMA_FILE,
        version: packageManifest.version,
        styles: {
            extractor: PURGECSS_EXTRACTOR,
            tokenEnd: PURGECSS_TOKEN_END,
            pseudoClasses: PURGECSS_PSEUDO_CLASS_PATTERN,
        },
        groups: GROUP_LABELS,
        ruleFiles: Object.fromEntries(
            configurations.map((manifest) => [
                manifest.configuration.name,
                listRuleFiles(manifest).map(({ path }) => path),
            ]),
        ),
        configurationSettings: Object.fromEntries(
            configurations.map((manifest) => [
                manifest.configuration.name,
                listConfigurationSettings(manifest.configuration.name),
            ]),
        ),
    };
}

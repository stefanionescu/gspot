// Add written configuration choices through the settings transaction.
import { compact } from '#cli/system/values.ts';
import { GspotError } from '#cli/system/errors.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { printResult } from '#cli/system/terminal.ts';
import { findScopeTable } from '#cli/settings/edit.ts';
import { type Command } from '@commander-js/extra-typings';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { Mutation } from '#cli/types/settings/file.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { unknownConfigurations } from '#cli/configurations/unknown-names.ts';
import { type ConfigurationsOptions } from '#cli/types/commands/save-settings.ts';
import { saveSettings, startSettingsEdit, refuseAlwaysSelected } from '#cli/commands/save-settings.ts';

/**
 * gspot add: appends configurations to the root list or to one scope's list.
 * @param options the parsed flags
 * @returns the command result
 */
async function addCommand(options: ConfigurationsOptions): Promise<CommandResult> {
    const { root, input } = await startSettingsEdit(options.cwd);
    parseSettings(input.text, root);
    const manifests = configurationManifests();
    const [unavailable] = unknownConfigurations(
        options.configurations.map((name) => ({ name })),
        manifests,
    );
    if (unavailable !== undefined) throw new GspotError('arguments', unavailable.message);
    refuseAlwaysSelected(options.configurations, manifests);
    const scopeTable = findScopeTable(input.table, options.scope);
    const current = settingsSchema.shape.configurations.unwrap().parse(scopeTable['configurations'] ?? []);
    const removed = settingsSchema.shape.removed_configurations.parse(scopeTable['removed_configurations']);
    if (options.configurations.every((name) => current.includes(name) && !removed.includes(name))) {
        return { text: 'nothing to add\n', json: { changed: false }, exitCode: 0 };
    }
    const mutation: Mutation = (written) => {
        const scopeTable = findScopeTable(written, options.scope);
        const list = settingsSchema.shape.configurations.unwrap().parse(scopeTable['configurations'] ?? []);
        for (const name of options.configurations) if (!list.includes(name)) list.push(name);
        scopeTable['configurations'] = list;
        const removed = settingsSchema.shape.removed_configurations.parse(scopeTable['removed_configurations']);
        if (scopeTable['removed_configurations'] !== undefined)
            scopeTable['removed_configurations'] = removed.filter((name) => !options.configurations.includes(name));
    };
    const where = options.scope === undefined ? '' : ` to scope ${options.scope}`;
    const description = `added ${options.configurations.join(', ')}${where}`;
    return await saveSettings(root, {
        input,
        change: mutation,
        summary: description,
    });
}

/**
 * Register the add command.
 * @param program the command program
 */
export function registerAdd(program: Command): void {
    program
        .command('add')
        .argument('<configuration...>', COMMAND_HELP.add.arguments['configuration'])
        .summary(COMMAND_HELP.add.summary)
        .description(COMMAND_HELP.add.description)
        .option('--scope <path>', COMMAND_HELP.add.options['--scope <path>'], trimTrailingSlashes)
        .action(async (configurations, flags) => {
            printResult(
                await addCommand({
                    cwd: process.cwd(),
                    configurations: configurations,
                    ...compact({ scope: flags.scope }),
                }),
            );
        });
}

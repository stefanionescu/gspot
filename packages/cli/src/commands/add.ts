// The add command: add configurations to gspot.toml.

import { findScopeTable } from '#cli/settings/edit.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { type Command } from '@commander-js/extra-typings';
import { saveSettings } from '#cli/apply/save-settings.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { Mutation } from '#cli/types/settings/edits.ts';
import { startConfigurationEdit } from '#cli/commands/settings.ts';
import { type ConfigurationsOptions } from '#cli/types/commands/settings.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';

/**
 * Add configurations to the root list or to the list of one scope.
 *
 * @param options the parsed flags.
 * @returns the command result.
 */
async function runAddCommand(options: ConfigurationsOptions): Promise<CommandResult> {
    const { root, input, scopeSettings } = startConfigurationEdit(options);
    const current = scopeSettings.configurations;
    const removed = scopeSettings.removed_configurations;
    if (options.configurations.every((name) => current.includes(name) && !removed.includes(name))) {
        return {
            text: `No change: ${options.configurations.join(' and ')} ${options.configurations.length === 1 ? 'is' : 'are'} already selected.\n`,
            json: { changed: false },
            exitCode: 0,
        };
    }
    const addConfigurations: Mutation = (written) => {
        const scopeTable = findScopeTable(written, options.scope);
        const list = [...current];
        for (const name of options.configurations) if (!list.includes(name)) list.push(name);
        scopeTable['configurations'] = list;
        if (scopeTable['removed_configurations'] !== undefined)
            scopeTable['removed_configurations'] = removed.filter((name) => !options.configurations.includes(name));
    };
    const where = options.scope === undefined ? '' : ` to scope ${options.scope}`;
    const description = `Added ${options.configurations.join(' and ')}${where}.`;
    return await saveSettings(root, {
        input,
        change: addConfigurations,
        summary: description,
    });
}

/**
 * Register the add command.
 *
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
export function registerAdd(program: Command, onResult: CommandCompletion): void {
    program
        .command('add')
        .argument('<configuration...>', COMMAND_HELP.add.arguments['configuration'])
        .summary(COMMAND_HELP.add.summary)
        .description(COMMAND_HELP.add.description)
        .option('--scope <path>', COMMAND_HELP.add.options['--scope <path>'], trimTrailingSlashes)
        .action(async (configurations, flags) => {
            onResult(
                await runAddCommand({
                    cwd: process.cwd(),
                    configurations: configurations,
                    ...stripUndefined({ scope: flags.scope }),
                }),
            );
        });
}

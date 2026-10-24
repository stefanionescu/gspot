import { getScopeTable } from '#cli/settings/edit.ts';
import { type Command } from '@commander-js/extra-typings';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { isTable, stripUndefined } from '#cli/system/tables.ts';
import { type ConfigurationsOptions } from '#cli/types/apply.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { applySettingsEdit, prepareConfigurationEdit } from '#cli/apply/settings.ts';

function restoreConfigurations(table: TomlTable, removed: string[], configurations: string[]): void {
    const previous = table['removed_configurations'];
    if (previous === undefined) return;
    const remaining = removed.filter((name) => !configurations.includes(name));
    if (remaining.length === 0) Reflect.deleteProperty(table, 'removed_configurations');
    else
        table['removed_configurations'] = {
            value: remaining,
            reason: isTable(previous) ? previous['reason'] : undefined,
        };
}

function formatConfigurationChange(changed: string[], unchanged: string[], where: string): string {
    let summary = `Added ${changed.join(' and ')}${where}.`;
    if (unchanged.length > 0)
        summary += ` ${unchanged.join(' and ')} ${unchanged.length === 1 ? 'is' : 'are'} already selected.`;
    return summary;
}

async function runAddCommand(options: ConfigurationsOptions): Promise<CommandResult> {
    const { root, input, scopeSettings, selected } = prepareConfigurationEdit(options);
    const scopeConfigurations = scopeSettings.configurations;
    const removed = scopeSettings.removed_configurations;
    if (options.configurations.every((name) => selected.includes(name))) {
        return {
            text: `No change: ${options.configurations.join(' and ')} ${options.configurations.length === 1 ? 'is' : 'are'} already selected.\n`,
            json: { changed: false },
            exitCode: 0,
        };
    }
    const scopeTable = getScopeTable(input.table, options.scope);
    const list = [...scopeConfigurations];
    for (const name of options.configurations) if (!selected.includes(name) && !list.includes(name)) list.push(name);
    scopeTable['configurations'] = list;
    restoreConfigurations(scopeTable, removed, options.configurations);
    const where = options.scope === undefined ? '' : ` to scope ${options.scope}`;
    const added = options.configurations.filter((name) => !selected.includes(name));
    const unchanged = options.configurations.filter((name) => selected.includes(name));
    const summary = formatConfigurationChange(added, unchanged, where);
    return await applySettingsEdit(root, {
        edit: input,
        summary,
    });
}

/**
Register the add command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
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
                    configurations,
                    ...stripUndefined({ scope: flags.scope }),
                }),
            );
        });
}

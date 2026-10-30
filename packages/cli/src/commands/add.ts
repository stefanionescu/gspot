import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { SCOPE_OPTION } from '#cli/config/commands/flags.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { isTable, stripUndefined } from '#cli/system/tables.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import type { ConfigurationsOptions } from '#cli/types/generation/settings-edit.ts';
import { applySettingsEdit, prepareConfigurationEdit } from '#cli/generation/settings-edit.ts';

function restoreConfigurations(table: TomlTable, added: string[]): void {
    const previous = table['removed_configurations'];
    if (!isTable(previous)) return;
    const remaining = Object.entries(previous).filter(([name]) => !added.includes(name));
    if (remaining.length === 0) Reflect.deleteProperty(table, 'removed_configurations');
    else table['removed_configurations'] = Object.fromEntries(remaining);
}

function formatConfigurationChange(changed: string[], unchanged: string[], where: string): string {
    let summary = `Added ${new Intl.ListFormat('en', { type: 'conjunction' }).format(changed)}${where}.`;
    if (unchanged.length > 0)
        summary += ` ${new Intl.ListFormat('en', { type: 'conjunction' }).format(unchanged)} ${unchanged.length === 1 ? 'is' : 'are'} already selected.`;
    return summary;
}

async function runAddCommand(options: ConfigurationsOptions): Promise<CommandResult> {
    const { root, input, scope, scopeTable, scopeSettings, selected, context } =
        await prepareConfigurationEdit(options);
    if (options.configurations.every((name) => selected.includes(name))) {
        const summary = `No change: ${new Intl.ListFormat('en', { type: 'conjunction' }).format(options.configurations)} ${options.configurations.length === 1 ? 'is' : 'are'} already selected.`;
        return {
            text: summary + '\n',
            json: { changed: false, summary },
            exitCode: 0,
        };
    }
    const scopeConfigurations = scopeSettings.configurations;
    const list = [...scopeConfigurations];
    const additions = options.configurations.filter((name) => !selected.includes(name));
    list.push(...additions.filter((name) => !list.includes(name)));
    scopeTable['configurations'] = list;
    restoreConfigurations(scopeTable, options.configurations);
    const where = scope === '' ? '' : ` to scope ${scope}`;
    const added = options.configurations.filter((name) => !selected.includes(name));
    const unchanged = options.configurations.filter((name) => selected.includes(name));
    const summary = formatConfigurationChange(added, unchanged, where);
    return await applySettingsEdit(root, {
        reads: context.reads,
        listing: context.listing,
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
        .option(SCOPE_OPTION, COMMAND_HELP.add.options[SCOPE_OPTION], stripTrailingSlashes)
        .action(async (configurations, flags) => {
            onResult(
                await runAddCommand({
                    cwd: process.cwd(),
                    configurations: [...new Set(configurations)],
                    ...stripUndefined({ scope: flags.scope }),
                }),
            );
        });
}

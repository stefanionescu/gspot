import { GspotError } from '#cli/system/errors.ts';
import { type Command } from '@commander-js/extra-typings';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import type { UnsetOptions } from '#cli/types/commands/unset.ts';
import { isTable, getValueAt, stripUndefined } from '#cli/system/tables.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { readSetting, applySettingsEdit, prepareSettingsEdit } from '#cli/apply/settings-edit.ts';
import { deleteKey, getScopeTable, removeFromList, getWrittenValue } from '#cli/settings/edit.ts';

// Remove entries from a written table, and drop the setting when no entries remain.
function removeTableItems(scopeTable: TomlTable, key: string, items: string[]): void {
    const table = getWrittenValue(getValueAt(scopeTable, key.split('.')));
    if (!isTable(table)) return;
    for (const item of items) Reflect.deleteProperty(table, item);
    if (Object.keys(table).length === 0) deleteKey(scopeTable, key);
}

/**
 * Run the unset command and return its output.
 *
 * @param options the flags and the settings edit choices.
 * @returns the edit result and the generated file changes.
 */
async function runUnsetCommand(options: UnsetOptions): Promise<CommandResult> {
    const { key, items } = options;

    const edit = prepareSettingsEdit(options.cwd);
    const { root, input } = edit;
    const { match } = await readSetting(edit, key, options.scope);

    if (items.length > 0 && !['list', 'table'].includes(match.setting.type))
        throw new GspotError(
            'arguments',
            `${key} is not a list or a table, so it takes no items. Run gspot unset ${key}.`,
        );
    const scopeTable = getScopeTable(input.table, options.scope);
    if (items.length === 0) deleteKey(scopeTable, key);
    else if (match.setting.type === 'list') removeFromList(scopeTable, key, items);
    else removeTableItems(scopeTable, key, items);
    return await applySettingsEdit(root, {
        edit: input,
        summary: items.length === 0 ? `Removed your value for ${key}.` : `Removed ${items.join(' and ')} from ${key}.`,
    });
}

/**
 * Register the unset command.
 *
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
export function registerUnset(program: Command, onResult: CommandCompletion): void {
    program
        .command('unset')
        .argument('<setting>', COMMAND_HELP.unset.arguments['setting'])
        .argument('[items...]', COMMAND_HELP.unset.arguments['items'])
        .summary(COMMAND_HELP.unset.summary)
        .description(COMMAND_HELP.unset.description)
        .option('--scope <path>', COMMAND_HELP.unset.options['--scope <path>'], trimTrailingSlashes)
        .action(async (setting, items, flags) => {
            onResult(
                await runUnsetCommand({
                    cwd: process.cwd(),
                    key: setting,
                    items,
                    ...stripUndefined({ scope: flags.scope }),
                }),
            );
        });
}

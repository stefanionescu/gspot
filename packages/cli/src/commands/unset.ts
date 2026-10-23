import { GspotError } from '#cli/system/errors.ts';
import { type Command } from '@commander-js/extra-typings';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import type { UnsetOptions } from '#cli/types/commands/unset.ts';
import { isTable, getValueAt, stripUndefined } from '#cli/system/tables.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { readSetting, applySettingsEdit, prepareSettingsEdit } from '#cli/apply/settings.ts';
import { deleteKey, getScopeTable, removeFromList, getWrittenValue } from '#cli/settings/edit.ts';

function removeTableKeys(scopeTable: TomlTable, key: string, keys: string[]): void {
    const table = getWrittenValue(getValueAt(scopeTable, key.split('.')));
    if (!isTable(table)) return;
    for (const name of keys) Reflect.deleteProperty(table, name);
    if (Object.keys(table).length === 0) deleteKey(scopeTable, key);
}

async function runUnsetCommand(options: UnsetOptions): Promise<CommandResult> {
    const { key, keys } = options;

    const edit = prepareSettingsEdit(options.cwd);
    const { root, input } = edit;
    const { match } = await readSetting(edit, key, options.scope);

    if (keys.length > 0 && !['list', 'table'].includes(match.setting.type))
        throw new GspotError(
            'arguments',
            `${key} is not a list or a table, so it takes no items. Run gspot unset ${key}.`,
        );
    const scopeTable = getScopeTable(input.table, options.scope);
    if (keys.length === 0) deleteKey(scopeTable, key);
    else if (match.setting.type === 'list') removeFromList(scopeTable, key, keys);
    else removeTableKeys(scopeTable, key, keys);
    return await applySettingsEdit(root, {
        edit: input,
        summary: keys.length === 0 ? `Removed your value for ${key}.` : `Removed ${keys.join(' and ')} from ${key}.`,
    });
}

/**
 * Register the unset command.
 *
 * @param program the gspot program that gets the command.
 * @param onResult receives the result of the command.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerUnset(program: Command, onResult: CommandCompletion): void {
    program
        .command('unset')
        .argument('<setting>', COMMAND_HELP.unset.arguments['setting'])
        .argument('[items...]', COMMAND_HELP.unset.arguments['items'])
        .summary(COMMAND_HELP.unset.summary)
        .description(COMMAND_HELP.unset.description)
        .option('--scope <path>', COMMAND_HELP.unset.options['--scope <path>'], trimTrailingSlashes)
        .action(async (setting, keys, flags) => {
            onResult(
                await runUnsetCommand({
                    cwd: process.cwd(),
                    key: setting,
                    keys: keys,
                    ...stripUndefined({ scope: flags.scope }),
                }),
            );
        });
}

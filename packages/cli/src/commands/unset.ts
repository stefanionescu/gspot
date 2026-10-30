import { GspotError } from '#cli/system/errors.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { isTable, getValueAt } from '#cli/system/tables.ts';
import { SCOPE_OPTION } from '#cli/config/commands/flags.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import type { UnsetOptions } from '#cli/types/commands/unset.ts';
import { removeKey, removeFromList } from '#cli/settings/edit.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { readSetting, applySettingsEdit, prepareSettingsEdit } from '#cli/generation/settings-edit.ts';

function removeTableKeys(scopeTable: TomlTable, key: string, names: string[]): void {
    const written = getValueAt(scopeTable, key.split('.'));
    const table = isReasonedValue(written) ? written.value : written;
    if (!isTable(table)) return;
    for (const name of names) Reflect.deleteProperty(table, name);
    if (Object.keys(table).length === 0) removeKey(scopeTable, key);
}

async function runUnsetCommand(options: UnsetOptions): Promise<CommandResult> {
    const { key, keys } = options;

    const edit = await prepareSettingsEdit(options.cwd, options.scope);
    const { root, edit: input, scopeTable } = edit;
    const { match } = readSetting(edit, key);

    if (keys.length > 0 && !['list', 'table'].includes(match.setting.type))
        throw new GspotError(
            'arguments',
            `${key} is not a list or a table, so it takes no items. Run gspot unset ${key}.`,
        );
    if (keys.length === 0) removeKey(scopeTable, key);
    else if (match.setting.type === 'list') removeFromList(scopeTable, key, keys);
    else removeTableKeys(scopeTable, key, keys);
    return await applySettingsEdit(root, {
        reads: edit.reads,
        listing: edit.listing,
        edit: input,
        summary: keys.length === 0 ? `Removed your value for ${key}.` : `Removed ${keys.join(' and ')} from ${key}.`,
    });
}

/**
Register the unset command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerUnset(program: Command, onResult: CommandCompletion): void {
    program
        .command('unset')
        .argument('<setting>', COMMAND_HELP.unset.arguments['setting'])
        .argument('[items...]', COMMAND_HELP.unset.arguments['items'])
        .summary(COMMAND_HELP.unset.summary)
        .description(COMMAND_HELP.unset.description)
        .option(SCOPE_OPTION, COMMAND_HELP.unset.options[SCOPE_OPTION], stripTrailingSlashes)
        .action(async (setting, keys, flags) => {
            onResult(
                await runUnsetCommand({
                    cwd: process.cwd(),
                    key: setting,
                    keys: keys,
                    scope: flags.scope,
                }),
            );
        });
}

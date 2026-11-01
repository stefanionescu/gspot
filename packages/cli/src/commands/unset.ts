import { GspotError } from '#cli/system/errors.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { type Command } from '@commander-js/extra-typings';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import type { TomlTable } from '#cli/types/settings/settings.ts';
import { removeKey, removeFromList } from '#cli/settings/edit.ts';
import { COMMAND_HELP, SCOPE_OPTION } from '#cli/config/commands/help.ts';
import type { SettingsEditOptions } from '#cli/types/generation/generation.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { type UnsetOptions, type CommandLocation } from '#cli/types/commands/commands.ts';
import { readSetting, writeSettingsEdit, readSettingsEditContext } from '#cli/commands/edits.ts';

function removeTableKeys(scopeTable: TomlTable, key: string, names: string[]): void {
    const written = findValueAt(scopeTable, key.split('.'));
    const table = isReasonedValue(written) ? written.value : written;
    if (!isTable(table)) return;
    for (const name of names) Reflect.deleteProperty(table, name);
    if (Object.keys(table).length === 0) removeKey(scopeTable, key);
}

function formatUnsetSummary(
    key: string,
    keys: string[],
    scope: string,
): Pick<SettingsEditOptions, 'summary' | 'unchangedSummary'> {
    const where = scope === '' ? '' : ` in scope ${scope}`;
    const names = keys.join(' and ');
    return {
        summary: keys.length === 0 ? `Removed your value for ${key}${where}.` : `Removed ${names} from ${key}${where}.`,
        ...(keys.length === 0
            ? {}
            : { unchangedSummary: `${names} ${keys.length === 1 ? 'is' : 'are'} not in ${key}${where}.` }),
    };
}

async function runUnsetCommand(options: UnsetOptions): Promise<CommandResult> {
    const { key, keys } = options;

    const edit = await readSettingsEditContext(options.root, options.scope);
    const { root, edit: input, scopeTable, scope } = edit;
    const { match } = readSetting(edit, key);

    if (keys.length > 0 && !['list', 'table'].includes(match.setting.type))
        throw new GspotError(
            'arguments',
            `${key} is not a list or a table, so it takes no items. Run gspot unset ${key}.`,
        );
    if (keys.length === 0) removeKey(scopeTable, key);
    else if (match.setting.type === 'list') removeFromList(scopeTable, key, keys);
    else removeTableKeys(scopeTable, key, keys);
    return await writeSettingsEdit(root, {
        cache: edit.cache,
        listing: edit.listing,
        edit: input,
        ...formatUnsetSummary(key, keys, scope),
    });
}

/**
Register the unset command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
@param location the calling folder and the Git root validated before the action.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerUnset(program: Command, onResult: CommandCompletion, location: CommandLocation): void {
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
                    root: location.root,
                    cwd: location.cwd,
                    key: setting,
                    keys: keys,
                    scope: flags.scope,
                }),
            );
        });
}

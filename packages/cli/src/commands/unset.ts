import { GspotError } from '#cli/system/errors.ts';
import { type Command } from '@commander-js/extra-typings';
import { getWrittenValue } from '#cli/settings/inherit.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { UnsetOptions } from '#cli/types/commands/edit-settings.ts';
import { isRecord, getValueAt, stripUndefined } from '#cli/system/values.ts';
import { deleteKey, findScopeTable, removeFromList } from '#cli/settings/edit.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { saveSettings, startSettingsEdit, findSettingDeclaration } from '#cli/apply/save-settings.ts';

/**
 * Register deletion of a written setting or selected list items and table entries.
 * @param program the command program
 * @param onResult the sink that writes the completed command result.
 */
function registerUnset(program: Command, onResult: CommandCompletion): void {
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

/**
 * Run the unset command and return its output.
 * @param options the command flags and settings edit choices.
 * @returns the settings edit result and generated file changes.
 */
async function runUnsetCommand(options: UnsetOptions): Promise<CommandResult> {
    const { key: setting, items } = options;

    const edit = startSettingsEdit(options.cwd);
    const { root, input } = edit;
    const { match } = findSettingDeclaration(root, edit, setting, options.scope);

    if (items.length > 0 && match.declaration.type !== 'list' && match.declaration.type !== 'table')
        throw new GspotError(
            'arguments',
            `${setting} is not a list, so it takes no items. Run gspot unset ${setting}.`,
        );
    return await saveSettings(root, {
        input,
        summary:
            items.length === 0
                ? `Removed your value for ${setting}.`
                : `Removed ${items.join(' and ')} from ${setting}.`,
        change: (written) => {
            const scopeTable = findScopeTable(written, options.scope);
            if (items.length === 0) {
                deleteKey(scopeTable, setting);
                return;
            }
            if (match.declaration.type === 'list') {
                removeFromList(scopeTable, setting, items);
                return;
            }
            const table = getWrittenValue(getValueAt(scopeTable, setting.split('.')));
            if (!isRecord(table)) return;
            for (const item of items) Reflect.deleteProperty(table, item);
            if (Object.keys(table).length === 0) deleteKey(scopeTable, setting);
        },
    });
}

export { registerUnset };

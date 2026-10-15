import { GspotError } from '#cli/errors.ts';
import { valueAt, isRecord } from '#cli/objects.ts';
import { printResult } from '#cli/terminal/print.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/commands/session.ts';
import { type Command } from '@commander-js/extra-typings';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { unknownSettingError } from '#cli/settings/errors/keys.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { writtenValue, declarationFor } from '#cli/settings/inherit.ts';
import { saveSettings, startSettingsEdit } from '#cli/commands/save-settings.ts';
import { deleteKey, findScopeTable, removeFromList } from '#cli/settings/edit.ts';

/**
 * Register deletion of a written setting or selected list items and table entries.
 * @param program the command program
 */
export function registerUnset(program: Command): void {
    program
        .command('unset')
        .argument('<setting>', COMMAND_HELP.unset.arguments['setting'])
        .argument('[items...]', COMMAND_HELP.unset.arguments['items'])
        .summary(COMMAND_HELP.unset.summary)
        .description(COMMAND_HELP.unset.description)
        .option('--scope <path>', COMMAND_HELP.unset.options['--scope <path>'], trimTrailingSlashes)
        .action(async (setting, items, flags) => {
            if (['configurations', 'removed_configurations'].includes(setting))
                throw new GspotError('arguments', 'Use gspot add or gspot remove to change configurations.');
            const { root, input } = await startSettingsEdit(process.cwd());
            const settings = parseSettings(input.text, root);
            findScopeTable(input.table, flags.scope);
            const session = await openSession(root, { settings, text: input.text });
            const known = (
                session.scopes.find((selection) => selection.scope.path === (flags.scope ?? '')) as ScopeSelection
            ).known;
            const match = declarationFor(known, setting);
            if (match === undefined) throw new GspotError('arguments', unknownSettingError(known, setting));
            if (items.length > 0 && match.declaration.type !== 'list' && match.declaration.type !== 'table')
                throw new GspotError(
                    'arguments',
                    `${setting} is not a list, so it takes no items. Run gspot unset ${setting}.`,
                );
            printResult(
                await saveSettings(root, {
                    input,
                    summary: `deleted from ${setting}`,
                    change: (written) => {
                        const scopeTable = findScopeTable(written, flags.scope);
                        if (items.length === 0) {
                            deleteKey(scopeTable, setting);
                            return;
                        }
                        if (match.declaration.type === 'list') {
                            removeFromList(scopeTable, setting, items);
                            return;
                        }
                        const table = writtenValue(valueAt(scopeTable, setting.split('.')));
                        if (!isRecord(table)) return;
                        for (const item of items) Reflect.deleteProperty(table, item);
                        if (Object.keys(table).length === 0) deleteKey(scopeTable, setting);
                    },
                }),
            );
        });
}

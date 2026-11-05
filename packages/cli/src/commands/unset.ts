import { readSettingsEditContext, selectSettingToEdit, writeSettingsEdit } from '#cli/commands/edits.ts';
import { SCOPE_OPTION } from '#cli/config/commands/help.ts';
import { removeFromList, removeKey } from '#cli/settings/edit.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { GspotError } from '#cli/system/errors.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { findValueAt, isTable } from '#cli/system/tables.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { CommandDefinition, ScopeFlags, SettingsEditOptions, UnsetOptions } from '#cli/types/commands/edits.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';

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
    scopePath: string,
): Pick<SettingsEditOptions, 'summary' | 'unchangedSummary'> {
    const where = scopePath === '' ? '' : ` in scope ${scopePath}`;
    const names = formatNameList(keys);
    return {
        summary: keys.length === 0 ? `Removed your value for ${key}${where}.` : `Removed ${names} from ${key}${where}.`,
        ...(keys.length > 0 && {
            unchangedSummary: `${names} ${keys.length === 1 ? 'is' : 'are'} not in ${key}${where}.`,
        }),
    };
}

async function runUnsetCommand(options: UnsetOptions): Promise<CommandResult> {
    const { key, keys } = options;

    const edit = await readSettingsEditContext(options.root, options.scopePath);
    const { root, edit: input, scopeTable, scopePath } = edit;
    const { match } = selectSettingToEdit(edit, key);

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
        previous: edit.session,
        ...formatUnsetSummary(key, keys, scopePath),
    });
}

export const UNSET_COMMAND: CommandDefinition<[string, string[]], ScopeFlags> = {
    name: 'unset',
    arguments: [{ term: '<setting>' }, { term: '[items...]' }],
    options: [{ flags: SCOPE_OPTION, parse: stripTrailingSlashes }],
    run: async ({ arguments: commandArguments, flags: { scope: scopePath }, root, cwd }) => {
        const [key, keys] = commandArguments;
        return await runUnsetCommand({ root, cwd, key, keys, scopePath });
    },
};

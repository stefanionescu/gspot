import { GspotError } from '#cli/system/errors.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { SCOPE_OPTION } from '#cli/config/commands/help.ts';
import { formatNameList, formatNameState } from '#cli/system/text/messages.ts';
import { removeKey, removeFromList, removeTableKeys } from '#cli/settings/toml/edit.ts';
import { writeSettingsEdit, selectSettingToEdit, readSettingsEditContext } from '#cli/commands/edits.ts';
import type { ScopeFlags, UnsetOptions, CommandDefinition, SettingsEditOptions } from '#cli/types/commands.ts';

function formatUnsetSummary(
    key: string,
    keys: string[],
    scopePath: string,
): Pick<SettingsEditOptions, 'summary' | 'unchangedSummary'> {
    const where = scopePath === '' ? '' : ` in scope ${scopePath}`;
    const names = formatNameList(keys);
    const absent = formatNameState(keys, `not in ${key}${where}`);
    return {
        summary: keys.length === 0 ? `Removed your value for ${key}${where}.` : `Removed ${names} from ${key}${where}.`,
        unchangedSummary:
            keys.length === 0 ? `No change: gspot.toml has no value for ${key}${where}.` : `No change: ${absent}.`,
    };
}

async function runUnsetCommand(options: UnsetOptions): Promise<CommandResult> {
    const { key, keys } = options;

    const edit = await readSettingsEditContext(options);
    const { scopeTable, scopePath } = edit;
    const { match } = selectSettingToEdit(edit, key);

    if (keys.length > 0 && !['list', 'table'].includes(match.setting.type))
        throw new GspotError(
            'arguments',
            `${key} is not a list or a table, so it takes no items. Run gspot unset ${key}.`,
        );
    if (keys.length === 0) removeKey(scopeTable, key);
    else if (match.setting.type === 'list') removeFromList(scopeTable, key, keys);
    else removeTableKeys(scopeTable, key, keys);
    return await writeSettingsEdit(edit, formatUnsetSummary(key, keys, scopePath));
}

export const UNSET_COMMAND: CommandDefinition<[string, string[]], ScopeFlags, Omit<UnsetOptions, 'root'>> = {
    name: 'unset',
    arguments: [{ term: '<setting>' }, { term: '[items...]' }],
    options: [{ flags: SCOPE_OPTION }],
    parse: ({ arguments: commandArguments, flags: { scope: scopePath }, cwd }) => {
        const [key, keys] = commandArguments;
        return { cwd, key, keys, scopePath };
    },
    run: runUnsetCommand,
};

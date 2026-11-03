import { setKey } from '#cli/settings/edit.ts';
import { parse } from '@decimalturn/toml-patch';
import { GspotError } from '#cli/system/errors.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { Setting } from '#cli/types/manifests.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { listSettingReaders } from '#cli/engine/skips.ts';
import { joinSettingPaths } from '#cli/settings/paths.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { findSettingSchema } from '#cli/settings/lookup.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import { isWeakening } from '#cli/settings/validation/reasons.ts';
import type { TomlTable, InheritedSetting } from '#cli/types/settings.ts';
import { SCOPE_OPTION, REASON_OPTION } from '#cli/config/commands/help.ts';
import { getSettingValue, findSettingDefault } from '#cli/settings/inherit.ts';
import { formatSettingValueError } from '#cli/settings/validation/messages.ts';
import { writeSettingsEdit, selectSettingToEdit, readSettingsEditContext } from '#cli/commands/edits.ts';
import { TOML_QUOTES, NUMBER_TEXT, BOOLEAN_WORDS, TOML_COMPOUND_START } from '#cli/config/commands/edits.ts';

import type {
    SetOptions,
    ReasonFlags,
    CommandDefinition,
    ParsedSettingValue,
    SettingsEditContext,
    SettingReasonContext,
} from '#cli/types/commands/edits.ts';

function parseInlineValue(text: string): unknown {
    try {
        return (parse(`value = ${text}`) as TomlTable)['value'];
    } catch (error) {
        throw new GspotError(
            'arguments',
            `The value ${text} is not a TOML inline value. Write a list as ["a", "b"] and a table as {key = "value"}, inside single quotes for the shell.`,
            { cause: error },
        );
    }
}

function parseScalarWord(word: string, setting: Setting): unknown {
    if (setting.type === 'boolean' && BOOLEAN_WORDS.has(word)) return word === 'true';
    return setting.type === 'number' && NUMBER_TEXT.test(word) ? Number(word) : word;
}

function parseWords(values: string[], setting: Setting): ParsedSettingValue {
    const [first, ...rest] = values as [string, ...string[]];
    const isCompound = rest.length === 0 && TOML_COMPOUND_START.test(first);
    if (setting.type === 'list') {
        const value = isCompound ? parseInlineValue(first) : values.map((word) => word.replace(TOML_QUOTES, '$2'));
        return { type: 'list', value: value as unknown[] };
    }
    if (rest.length > 0)
        throw new GspotError('arguments', `${setting.name} takes one value. Quote a value with spaces.`);
    return {
        type: 'scalar',
        value: isCompound && setting.type === 'table' ? parseInlineValue(first) : parseScalarWord(first, setting),
    };
}

function parseSettingValue(values: string[], setting: Setting): ParsedSettingValue {
    const parsed = parseWords(values, setting);
    const schema = findSettingSchema(setting.name);
    const validation = schema?.safeParse(parsed.value);
    if (schema === undefined || validation?.success !== false) return parsed;
    throw new GspotError(
        'arguments',
        formatSettingValueError(values.join(' '), setting, { schema, error: validation.error }),
    );
}

function requireReason({ key, reason }: SetOptions): string {
    if (reason === undefined)
        throw new GspotError(
            'arguments',
            `${key} keeps a reason for each entry. Add --reason "<why>" with why each one belongs.`,
        );
    return reason;
}

function setSettingValue(scopeTable: TomlTable, change: ParsedSettingValue, setting: Setting, key: string): void {
    if (change.type === 'list') setKey(scopeTable, key, change.value);
    else if (setting.type === 'table' && isTable(change.value)) {
        const written = findValueAt(scopeTable, key.split('.'));
        const writtenValue = isReasonedValue(written) ? written.value : written;
        setKey(scopeTable, key, { ...(isTable(writtenValue) && writtenValue), ...change.value });
    } else setKey(scopeTable, key, change.value);
}

function setSetting(scopeTable: TomlTable, change: ParsedSettingValue, setting: Setting, options: SetOptions): void {
    setSettingValue(scopeTable, change, setting, options.key);
    if (options.reason === undefined || setting.reason_values === true) return;
    const written = findValueAt(scopeTable, options.key.split('.'));
    const value = isReasonedValue(written) ? written.value : written;
    setKey(scopeTable, options.key, { value, reason: options.reason });
}

function assertReason({ options, setting, change, joined, previous, shippedDefault }: SettingReasonContext): void {
    if (setting.reason_values === true) return;
    const isWeaker = isWeakening(setting, joined, shippedDefault);
    if (options.reason === undefined) {
        if (isWeaker && change.type === 'list' && previous?.reason !== undefined)
            throw new GspotError(
                'arguments',
                `${options.key} already has the reason ${JSON.stringify(previous.reason)}. Pass --reason with a reason that covers every item.`,
            );
        return;
    }
    if (!isWeaker)
        throw new GspotError(
            'arguments',
            `${options.key} takes no reason here: the value does not loosen the shipped default. Run the command without --reason.`,
        );
}

function formatSettingChange(
    change: ParsedSettingValue,
    context: {
        setting: Setting;
        options: SetOptions;
        scope: string;
        previous: InheritedSetting | undefined;
    },
): string {
    const { setting, options, scope, previous } = context;
    const displayKey = options.key;
    const where = scope === '' ? '' : ` in scope ${scope}`;
    const was =
        previous?.value === undefined ? '' : `  (was ${JSON.stringify(previous.value)} from ${previous.source})`;
    if (setting.reason_values === true)
        return `Added ${formatNameList(options.values)} to ${displayKey}${where}.${was}`;
    const reason = options.reason === undefined ? '' : `  # ${options.reason}`;
    return `Set ${displayKey} to ${JSON.stringify(change.value)}${where}.${reason}${was}`;
}

function buildSettingChange(
    edit: SettingsEditContext,
    options: SetOptions,
): { setting: Setting; change: ParsedSettingValue; summary: string; notes: string[] } {
    const { settings } = edit;
    const { availableSettings, match, scope } = selectSettingToEdit(edit, options.key);
    const setting = match.setting;
    const change: ParsedSettingValue =
        setting.reason_values === true
            ? {
                  type: 'scalar',
                  value: Object.fromEntries(options.values.map((name) => [name, requireReason(options)])),
              }
            : parseSettingValue(options.values, setting);
    const previous = getSettingValue(availableSettings, settings, options.key, edit.scope);
    const shippedDefault = findSettingDefault(availableSettings, settings, match, edit.scope)?.value;
    const joined = joinSettingPaths(options.key, change.value, edit.scope);
    assertReason({ options, setting, change, joined, previous, shippedDefault });
    const readers = listSettingReaders(settings, scope, options.key);
    const notes =
        options.key.startsWith('limits.') && readers.every((reader) => !reader.enabled)
            ? [`No selected check reads ${options.key} at level ${settings.level}.`]
            : [];
    const summary = formatSettingChange(change, { setting, options, scope: edit.scope, previous });
    return { setting, change, summary, notes };
}

async function runSetCommand(options: SetOptions): Promise<CommandResult> {
    const edit = await readSettingsEditContext(options.root, options.scope);
    const { root, edit: input, scopeTable } = edit;
    const { setting, change, summary, notes } = buildSettingChange(edit, options);
    setSetting(scopeTable, change, setting, options);
    return await writeSettingsEdit(root, {
        edit: input,
        summary,
        notes,
        cache: edit.cache,
        listing: edit.listing,
        previous: edit.session,
    });
}

export const SET_COMMAND: CommandDefinition<[string, string[]], ReasonFlags> = {
    name: 'set',
    arguments: [{ term: '<setting>' }, { term: '<values...>' }],
    options: [{ flags: REASON_OPTION }, { flags: SCOPE_OPTION, parse: stripTrailingSlashes }],
    run: async ([key, values], { reason, scope }, { root, cwd }) =>
        await runSetCommand({ root, cwd, key, values, reason, scope }),
};

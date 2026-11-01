import { setKey } from '#cli/settings/edit.ts';
import { parse } from '@decimalturn/toml-patch';
import { GspotError } from '#cli/system/errors.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { Setting } from '#cli/types/manifests.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { listSettingReaders } from '#cli/engine/skips.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { findSettingSchema } from '#cli/settings/lookup.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import type { TomlTable, InheritedSetting } from '#cli/types/settings.ts';
import { SCOPE_OPTION, REASON_OPTION } from '#cli/config/commands/help.ts';
import { getSettingValue, findSettingDefault } from '#cli/settings/inherit.ts';
import { formatSettingValueError } from '#cli/settings/validation/messages.ts';
import { NUMBER_TEXT, TOML_COMPOUND_START } from '#cli/config/commands/edits.ts';
import { readSetting, writeSettingsEdit, readSettingsEditContext } from '#cli/commands/edits.ts';

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

function parseValueArgument(text: string): unknown {
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (NUMBER_TEXT.test(text)) return Number(text);
    return TOML_COMPOUND_START.test(text) ? parseInlineValue(text) : text;
}

function buildSettingValue(words: unknown[], setting: Setting): ParsedSettingValue {
    const scalar = words.length === 1 ? words[0] : words;
    if (setting.type === 'list') return { type: 'list', value: Array.isArray(scalar) ? scalar : words };
    return { type: 'scalar', value: scalar };
}

function parseSettingValue(values: string[], setting: Setting): ParsedSettingValue {
    const typed = buildSettingValue(
        values.map((text) => parseValueArgument(text)),
        setting,
    );
    const schema = findSettingSchema(setting.name);
    if (schema === undefined) return typed;
    const validation = schema.safeParse(typed.value);
    if (validation.success) return typed;
    const untyped = buildSettingValue(values, setting);
    if (schema.safeParse(untyped.value).success) return untyped;
    throw new GspotError(
        'arguments',
        formatSettingValueError(values.join(' '), setting, { schema, error: validation.error }),
    );
}

function buildReasonTable(options: SetOptions): ParsedSettingValue {
    const { reason } = options;
    if (reason === undefined)
        throw new GspotError(
            'arguments',
            `${options.key} keeps a reason for each entry. Add --reason "<why>" with why each one belongs.`,
        );
    return { type: 'scalar', value: Object.fromEntries(options.values.map((value) => [value, reason])) };
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

function assertReason({ options, setting, change, previous, shippedDefault }: SettingReasonContext): void {
    if (setting.reason_values === true) return;
    const loosens = isLoosening(setting, change.value, shippedDefault);
    if (options.reason === undefined) {
        if (change.type === 'list' && previous?.reason !== undefined && loosens)
            throw new GspotError(
                'arguments',
                `${options.key} already has the reason ${JSON.stringify(previous.reason)}. Pass --reason with a reason that covers every item.`,
            );
        return;
    }
    if (!loosens)
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

function readSettingChange(
    edit: SettingsEditContext,
    options: SetOptions,
): { setting: Setting; change: ParsedSettingValue; summary: string; notes: string[] } {
    const { settings } = edit;
    const { availableSettings, match, scope } = readSetting(edit, options.key);
    const setting = match.setting;
    const change =
        setting.reason_values === true ? buildReasonTable(options) : parseSettingValue(options.values, setting);
    const previous = getSettingValue(availableSettings, settings, options.key, edit.scope);
    const shippedDefault = findSettingDefault(availableSettings, settings, match, edit.scope)?.value;
    assertReason({ options, setting, change, previous, shippedDefault });
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
    const { setting, change, summary, notes } = readSettingChange(edit, options);
    try {
        setSetting(scopeTable, change, setting, options);
        return await writeSettingsEdit(root, { edit: input, summary, notes, cache: edit.cache, listing: edit.listing });
    } catch (error) {
        if (error instanceof GspotError && error.code === 'settings')
            throw new GspotError('arguments', error.message, { cause: error });
        throw error;
    }
}

export const setCommand: CommandDefinition<[string, string[]], ReasonFlags> = {
    name: 'set',
    arguments: [{ term: '<setting>' }, { term: '<values...>' }],
    options: [{ flags: REASON_OPTION }, { flags: SCOPE_OPTION, parse: stripTrailingSlashes }],
    run: async ([key, values], { reason, scope }, { root, cwd }) =>
        await runSetCommand({ root, cwd, key, values, reason, scope }),
};

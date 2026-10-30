import { setKey } from '#cli/settings/edit.ts';
import { parse } from '@decimalturn/toml-patch';
import { GspotError } from '#cli/system/errors.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { COMMAND_SUGGESTION } from '#cli/config/main.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { listSettingReaders } from '#cli/planning/readers.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import { findSettingSchema } from '#cli/settings/schema-lookup.ts';
import { type Command, CommanderError } from '@commander-js/extra-typings';
import { SCOPE_OPTION, REASON_OPTION } from '#cli/config/commands/flags.ts';
import { isTable, getValueAt, stripUndefined } from '#cli/system/tables.ts';
import { getSettingValue, findSettingDefault } from '#cli/settings/inherit.ts';
import { formatSettingValueError } from '#cli/settings/validation/messages.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import type { SettingsEditContext } from '#cli/types/generation/settings-edit.ts';
import type { Setting, InheritedSetting } from '#cli/types/settings/inheritance.ts';
import { NUMBER_TEXT, DASH_VALUE_HELP, TOML_COMPOUND_START } from '#cli/config/commands/set.ts';
import { readSetting, applySettingsEdit, prepareSettingsEdit } from '#cli/generation/settings-edit.ts';
import type { SetOptions, ParsedSettingValue, SettingReasonContext } from '#cli/types/commands/set.ts';

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
        const written = getValueAt(scopeTable, key.split('.'));
        const writtenValue = isReasonedValue(written) ? written.value : written;
        setKey(scopeTable, key, { ...(isTable(writtenValue) && writtenValue), ...change.value });
    } else setKey(scopeTable, key, change.value);
}

function editSetting(scopeTable: TomlTable, change: ParsedSettingValue, setting: Setting, options: SetOptions): void {
    setSettingValue(scopeTable, change, setting, options.key);
    if (options.reason === undefined || setting.reason_values === true) return;
    const written = getValueAt(scopeTable, options.key.split('.'));
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
    if (setting.reason_values === true) return `Added ${options.values.join(' and ')} to ${displayKey}${where}.${was}`;
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
    const edit = await prepareSettingsEdit(options.cwd, options.scope);
    const { root, edit: input, scopeTable } = edit;
    const { setting, change, summary, notes } = readSettingChange(edit, options);
    try {
        editSetting(scopeTable, change, setting, options);
        return await applySettingsEdit(root, { edit: input, summary, notes, reads: edit.reads, listing: edit.listing });
    } catch (error) {
        if (error instanceof GspotError && error.code === 'settings')
            throw new GspotError('arguments', error.message, { cause: error });
        throw error;
    }
}

/**
Register the set command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
export function registerSet(program: Command, onResult: CommandCompletion): void {
    program
        .command('set')
        .argument('<setting>', COMMAND_HELP.set.arguments['setting'])
        .argument('<values...>', COMMAND_HELP.set.arguments['values'])
        .summary(COMMAND_HELP.set.summary)
        .description(COMMAND_HELP.set.description)
        .option(REASON_OPTION, COMMAND_HELP.set.options[REASON_OPTION])
        .option(SCOPE_OPTION, COMMAND_HELP.set.options[SCOPE_OPTION], stripTrailingSlashes)
        .exitOverride((error) => {
            if (error.code !== 'commander.unknownOption') throw error;
            const suggestion = COMMAND_SUGGESTION.exec(error.message)?.[0] ?? '';
            const message = `${error.message.replace(suggestion, '').trimEnd()}. ${DASH_VALUE_HELP} ${suggestion}`;
            throw new CommanderError(error.exitCode, error.code, message);
        })
        .action(async (setting, values, flags) => {
            onResult(
                await runSetCommand({
                    cwd: process.cwd(),
                    key: setting,
                    values: values,
                    ...stripUndefined({ reason: flags.reason, scope: flags.scope }),
                }),
            );
        });
}

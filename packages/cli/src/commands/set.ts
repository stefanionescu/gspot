import { setKey } from '#cli/settings/edit.ts';
import { GspotError } from '#cli/system/errors.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { listSettingReaders } from '#cli/planning/readers.ts';
import type { SettingsEditContext } from '#cli/types/apply.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import { parseTomlText, isReasonedValue } from '#cli/settings/file.ts';
import { type Command, CommanderError } from '@commander-js/extra-typings';
import { RECORD_FIELDS, findSettingSchema } from '#cli/settings/schemas.ts';
import { isTable, getValueAt, stripUndefined } from '#cli/system/tables.ts';
import { getSettingValue, findSettingDefault } from '#cli/settings/inherit.ts';
import { formatSettingValueError } from '#cli/settings/validation/messages.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { type Setting, type InheritedSetting } from '#cli/types/settings/inheritance.ts';
import { readSetting, applySettingsEdit, prepareSettingsEdit } from '#cli/apply/settings.ts';
import { NUMBER_TEXT, DASH_VALUE_HELP, TOML_COMPOUND_START } from '#cli/config/commands/set.ts';
import { type SetOptions, type ParsedSettingValue, type SettingReasonContext } from '#cli/types/commands/set.ts';

function parseStructured(text: string): unknown {
    try {
        return parseTomlText(`value = ${text}`, 'value')['value'];
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
    return TOML_COMPOUND_START.test(text) ? parseStructured(text) : text;
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

function parseReasonTable(options: SetOptions): ParsedSettingValue {
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

function assertReasonPresent({
    options,
    setting,
    change,
    shippedDefault,
}: Omit<SettingReasonContext, 'previous'>): void {
    if (
        options.reason === undefined ||
        setting.reason_values === true ||
        isLoosening(setting, change.value, shippedDefault)
    )
        return;
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
        scope: string | undefined;
        previous: InheritedSetting | undefined;
    },
): string {
    const { setting, options, scope, previous } = context;
    const displayKey = scope === undefined ? options.key : `scope.${scope}.${options.key}`;
    const was =
        previous?.value === undefined ? '' : `  (was ${JSON.stringify(previous.value)} from ${previous.source})`;
    if (setting.reason_values === true) return `Added ${options.values.join(' and ')} to ${displayKey}.${was}`;
    const reason = options.reason === undefined ? '' : `  # ${options.reason}`;
    return `Set ${displayKey} to ${JSON.stringify(change.value)}.${reason}${was}`;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, it puts runSetCommand over the complexity limit of 8.
function assertReasonCoversList({ options, setting, change, previous, shippedDefault }: SettingReasonContext): void {
    if (
        change.type === 'list' &&
        options.reason === undefined &&
        previous?.reason !== undefined &&
        isLoosening(setting, change.value, shippedDefault)
    )
        throw new GspotError(
            'arguments',
            `${options.key} already has the reason ${JSON.stringify(previous.reason)}. Pass --reason with a reason that covers every item.`,
        );
}

async function readSettingChange(
    edit: SettingsEditContext,
    options: SetOptions,
): Promise<{ setting: Setting; change: ParsedSettingValue; summary: string }> {
    const { settings } = edit;
    const { availableSettings, match, scope } = await readSetting(edit, options.key);
    const setting = match.setting;
    const change =
        setting.reason_values === true ? parseReasonTable(options) : parseSettingValue(options.values, setting);
    const previous = getSettingValue(availableSettings, settings, options.key, edit.scope);
    const shippedDefault = findSettingDefault(availableSettings, settings, match, edit.scope)?.value;
    assertReasonCoversList({ options, setting, change, previous, shippedDefault });
    assertReasonPresent({ options, setting, change, shippedDefault });
    const readers = listSettingReaders(settings, scope, options.key);
    const note =
        options.key.startsWith('limits.') && readers.every((reader) => !reader.enabled)
            ? `\nnote     No selected check reads ${options.key} at level ${settings.level}.`
            : '';
    const summary = formatSettingChange(change, { setting, options, scope: edit.scope, previous }) + note;
    return { setting, change, summary };
}

async function runSetCommand(options: SetOptions): Promise<CommandResult> {
    if (Object.hasOwn(RECORD_FIELDS, options.key))
        throw new GspotError(
            'arguments',
            options.key === 'ignore'
                ? 'Run gspot ignore <check> --reason "<why>" to add an ignore.'
                : `Write [[${options.key}]] by hand in gspot.toml. Record lists have their own fields.`,
        );
    const edit = prepareSettingsEdit(options.cwd, options.scope);
    const { root, input, scopeTable } = edit;
    const { setting, change, summary } = await readSettingChange(edit, options);
    try {
        editSetting(scopeTable, change, setting, options);
        return await applySettingsEdit(root, { edit: input, summary });
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
        .option('--reason <text>', COMMAND_HELP.set.options['--reason <text>'])
        .option('--scope <path>', COMMAND_HELP.set.options['--scope <path>'], trimTrailingSlashes)
        .exitOverride((error) => {
            if (error.code !== 'commander.unknownOption') throw error;
            throw new CommanderError(error.exitCode, error.code, `${error.message}. ${DASH_VALUE_HELP}`);
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

import { GspotError } from '#cli/system/errors.ts';
import { parseTomlText } from '#cli/settings/file.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import { type Command, CommanderError } from '@commander-js/extra-typings';
import { isTable, getValueAt, stripUndefined } from '#cli/system/tables.ts';
import { getSettingValue, findSettingDefault } from '#cli/settings/inherit.ts';
import { NUMBER, STRUCTURED, DASH_VALUE_HELP } from '#cli/config/commands/set.ts';
import { listRecordFields, findSettingSchema } from '#cli/schemas/settings/file.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { type Setting, type EffectiveSetting } from '#cli/types/settings/inheritance.ts';
import { setKey, addToList, getScopeTable, getWrittenValue } from '#cli/settings/edit.ts';
import { readSetting, applySettingsEdit, prepareSettingsEdit } from '#cli/apply/settings.ts';
import { type SetOptions, type ParsedSettingValue, type SettingReasonContext } from '#cli/types/commands/set.ts';

// Structured values use the inline syntax of gspot.toml.
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
    if (NUMBER.test(text)) return Number(text);
    const isStructured = STRUCTURED.test(text);
    return isStructured ? parseStructured(text) : text;
}

function parseSettingValue(values: string[], setting: Setting): ParsedSettingValue {
    const parsed = values.map((text) => parseValueArgument(text));
    const scalar = parsed.length === 1 ? parsed[0] : parsed;
    const validation = findSettingSchema(setting.name)?.safeParse(scalar);
    if (validation?.success === false) {
        const issue = validation.error.issues.find((issue) => issue.code === 'invalid_value');
        if (issue !== undefined)
            throw new GspotError(
                'arguments',
                `The value ${values.join(' ')} is not valid for ${setting.name}. Use ${issue.values.map(String).join(' or ')}.`,
            );
    }
    if (setting.type === 'list') return { type: 'list', value: Array.isArray(scalar) ? scalar : parsed };
    return { type: 'scalar', value: scalar };
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

function editSetting(table: TomlTable, change: ParsedSettingValue, setting: Setting, options: SetOptions): void {
    const scopeTable = getScopeTable(table, options.scope);
    if (change.type === 'list') addToList(scopeTable, options.key, change.value);
    else if (setting.type === 'table' && isTable(change.value)) {
        const written = getValueAt(scopeTable, options.key.split('.'));
        const writtenValue = getWrittenValue(written);
        setKey(scopeTable, options.key, { ...(isTable(writtenValue) ? writtenValue : {}), ...change.value });
    } else setKey(scopeTable, options.key, change.value);
    if (options.reason !== undefined && setting.reason_values !== true) {
        const written = getValueAt(scopeTable, options.key.split('.'));
        const value = getWrittenValue(written);
        setKey(scopeTable, options.key, { value, reason: options.reason });
    }
}

// gspot keeps reasons for values that loosen a check, so set refuses a reason on any other value before it writes.
function assertReasonPresent({
    options,
    setting,
    change,
    shippedDefault,
}: Omit<SettingReasonContext, 'previous'>): void {
    if (options.reason === undefined || setting.reason_values === true) return;
    if (isLoosening(setting, change.value, shippedDefault)) return;
    throw new GspotError(
        'arguments',
        `${options.key} takes no reason here: the value does not loosen the shipped default. Run the command without --reason.`,
    );
}

function formatSettingChange(
    change: ParsedSettingValue,
    context: { setting: Setting; options: SetOptions; previous: EffectiveSetting | undefined },
): string {
    const { setting, options, previous } = context;
    const displayKey = options.scope === undefined ? options.key : `scope.${options.scope}.${options.key}`;
    const isReasonTable = setting.reason_values === true;
    const was =
        previous?.value === undefined ? '' : `  (was ${JSON.stringify(previous.value)} from ${previous.source})`;
    if (isReasonTable) return `Added ${options.values.join(' and ')} to ${displayKey}.${was}`;
    const reason = options.reason === undefined ? '' : `  # ${options.reason}`;
    if (!Array.isArray(change.value)) return `Set ${displayKey} to ${JSON.stringify(change.value)}.${reason}${was}`;
    // A list value may hold a command, so each item keeps its quotes.
    const description =
        change.type === 'list'
            ? `Added ${change.value.map((value) => JSON.stringify(value)).join(', ')} to ${displayKey}.`
            : `Set ${displayKey} to ${JSON.stringify(change.value)}.`;
    return `${description}${reason}${was}`;
}

// A list change that drops the reason keeps the old reason only when the new reason covers every item.
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

/**
 * Write a setting, add list items, or change the keys of a table.
 *
 * @param options the parsed flags.
 * @returns the command result.
 */
async function runSetCommand(options: SetOptions): Promise<CommandResult> {
    if (Object.hasOwn(listRecordFields(), options.key))
        throw new GspotError(
            'arguments',
            options.key === 'ignore'
                ? 'Run gspot ignore <check> --reason "<why>" to add an ignore.'
                : `Write [[${options.key}]] by hand in gspot.toml. Record lists have their own fields.`,
        );
    const edit = prepareSettingsEdit(options.cwd);
    const { root, input, settings } = edit;
    const { available: availableSettings, match } = await readSetting(edit, options.key, options.scope);
    const setting = match.setting;
    const change =
        setting.reason_values === true ? parseReasonTable(options) : parseSettingValue(options.values, setting);
    const previous = getSettingValue(availableSettings, settings, options.key, options.scope);
    const shippedDefault = findSettingDefault(availableSettings, settings, match, options.scope)?.value;
    assertReasonCoversList({ options, setting, change, previous, shippedDefault });
    assertReasonPresent({ options, setting, change, shippedDefault });
    const summary = formatSettingChange(change, {
        setting,
        options,
        previous,
    });
    try {
        editSetting(input.table, change, setting, options);
        return await applySettingsEdit(root, { edit: input, summary });
    } catch (error) {
        if (error instanceof GspotError && error.code === 'settings')
            throw new GspotError('arguments', error.message, { cause: error });
        throw error;
    }
}

/**
 * Register the set command.
 *
 * @param program the gspot program that gets the command.
 * @param onResult receives the result of the command.
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

// The set command: validate and write one setting.
import { GspotError } from '#cli/system/errors.ts';
import { parseTomlText } from '#cli/settings/file.ts';
import { saveSettings } from '#cli/apply/save-settings.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import type { EffectiveSetting } from '#cli/types/settings/values.ts';
import { type SettingDeclaration } from '#cli/types/settings/tables.ts';
import { type Command, CommanderError } from '@commander-js/extra-typings';
import { isRecord, getValueAt, stripUndefined } from '#cli/system/values.ts';
import { getSettingValue, findSettingDefault } from '#cli/settings/inherit.ts';
import { NUMBER, STRUCTURED, DASH_VALUE_HINT } from '#cli/config/commands/set.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { startSettingsEdit, findSettingDeclaration } from '#cli/commands/settings.ts';
import { listRecordFields, findSettingSchema } from '#cli/schemas/settings/gspot-toml.ts';
import { setKey, addToList, findScopeTable, getWrittenValue } from '#cli/settings/edit.ts';
import { type SetOptions, type ParsedSettingValue, type SettingReasonContext } from '#cli/types/commands/settings.ts';

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

function parseSettingValue(items: string[], declaration: SettingDeclaration): ParsedSettingValue {
    const parsed = items.map((item) => parseValueArgument(item));
    const scalar = parsed.length === 1 ? parsed[0] : parsed;
    const validation = findSettingSchema(declaration.name)?.safeParse(scalar);
    if (validation?.success === false) {
        const issue = validation.error.issues.find((issue) => issue.code === 'invalid_value');
        if (issue !== undefined)
            throw new GspotError(
                'arguments',
                `The value \`${items.join(' ')}\` is not valid for ${declaration.name}. Use ${issue.values.map(String).join(' or ')}.`,
            );
    }
    if (declaration.type === 'list') return { type: 'list', value: Array.isArray(scalar) ? scalar : parsed };
    return { type: 'scalar', value: scalar };
}

function parseReasonEntries(options: SetOptions): ParsedSettingValue {
    const { reason } = options;
    if (reason === undefined)
        throw new GspotError(
            'arguments',
            `${options.key} keeps a reason for each entry. Add --reason "..." with why each one belongs.`,
        );
    return { type: 'scalar', value: Object.fromEntries(options.items.map((item) => [item, reason])) };
}

function editSetting(
    table: TomlTable,
    change: ParsedSettingValue,
    declaration: SettingDeclaration,
    options: SetOptions,
): void {
    const scopeTable = findScopeTable(table, options.scope);
    if (change.type === 'list') addToList(scopeTable, options.key, change.value);
    else if (declaration.type === 'table' && isRecord(change.value)) {
        const current = getValueAt(scopeTable, options.key.split('.'));
        const existing = getWrittenValue(current);
        setKey(scopeTable, options.key, { ...(isRecord(existing) ? existing : {}), ...change.value });
    } else setKey(scopeTable, options.key, change.value);
    if (options.reason !== undefined && declaration.reason_values !== true) {
        const current = getValueAt(scopeTable, options.key.split('.'));
        const value = getWrittenValue(current);
        setKey(scopeTable, options.key, { value, reason: options.reason });
    }
}

function refuseIncompleteReason({
    options,
    declaration,
    change,
    previous,
    shippedDefault,
}: SettingReasonContext): void {
    if (
        change.type === 'list' &&
        options.reason === undefined &&
        previous?.reason !== undefined &&
        isLoosening(declaration, change.value, shippedDefault)
    )
        throw new GspotError(
            'arguments',
            `${options.key} already has the reason ${JSON.stringify(previous.reason)}. Pass --reason with a reason that covers every item.`,
        );
}

// gspot keeps reasons for values that loosen a check, so set refuses a reason on any other value before it writes.
function refuseUnneededReason({
    options,
    declaration,
    change,
    shippedDefault,
}: Omit<SettingReasonContext, 'previous'>): void {
    if (options.reason === undefined || declaration.reason_values === true) return;
    if (isLoosening(declaration, change.value, shippedDefault)) return;
    throw new GspotError(
        'arguments',
        `${options.key} takes no reason here: the value does not loosen the shipped default. Run the command without --reason.`,
    );
}

function describeSettingChange(
    change: ParsedSettingValue,
    context: { declaration: SettingDeclaration; options: SetOptions; previous: EffectiveSetting | undefined },
): string {
    const { declaration, options, previous } = context;
    const shown = options.scope === undefined ? options.key : `scope.${options.scope}.${options.key}`;
    const isReasonTable = declaration.reason_values === true;
    const was =
        previous?.value === undefined ? '' : `  (was ${JSON.stringify(previous.value)} from ${previous.source})`;
    if (isReasonTable) return `Added ${options.items.join(' and ')} to ${shown}.${was}`;
    const reason = options.reason === undefined ? '' : `  # ${options.reason}`;
    if (!Array.isArray(change.value)) return `Set ${shown} to ${JSON.stringify(change.value)}.${reason}${was}`;
    const items = change.value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' and ');
    const description = change.type === 'list' ? `Added ${items} to ${shown}.` : `Set ${shown} to ${items}.`;
    return `${description}${reason}${was}`;
}

/**
 * Write a setting, add list items, or change table entries.
 *
 * @param options the parsed flags.
 * @returns the command result.
 */
async function runSetCommand(options: SetOptions): Promise<CommandResult> {
    if (Object.hasOwn(listRecordFields(), options.key))
        throw new GspotError(
            'arguments',
            `Write [[${options.key}]] by hand in gspot.toml. Record lists have their own fields.`,
        );
    const edit = startSettingsEdit(options.cwd);
    const { root, input, settings } = edit;
    const { known, match } = await findSettingDeclaration(edit, options.key, options.scope);
    const declaration = match.declaration;
    const change =
        declaration.reason_values === true
            ? parseReasonEntries(options)
            : parseSettingValue(options.items, declaration);
    const previous = getSettingValue(known, settings, options.key, options.scope);
    const shippedDefault = findSettingDefault(known, settings, match, options.scope)?.value;
    refuseIncompleteReason({ options, declaration, change, previous, shippedDefault });
    refuseUnneededReason({ options, declaration, change, shippedDefault });
    const summary = describeSettingChange(change, {
        declaration,
        options,
        previous,
    });
    try {
        editSetting(input.table, change, declaration, options);
        return await saveSettings(root, { input, summary });
    } catch (error) {
        if (error instanceof GspotError && error.code === 'settings')
            throw new GspotError('arguments', error.message, { cause: error });
        throw error;
    }
}

/**
 * Register the set command.
 *
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
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
            throw new CommanderError(error.exitCode, error.code, `${error.message}. ${DASH_VALUE_HINT}`);
        })
        .action(async (setting, items, flags) => {
            onResult(
                await runSetCommand({
                    cwd: process.cwd(),
                    key: setting,
                    items,
                    ...stripUndefined({ reason: flags.reason, scope: flags.scope }),
                }),
            );
        });
}

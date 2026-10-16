// Write settings through the same validation and mutation.
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { parseTomlText } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { printResult } from '#cli/system/terminal.ts';
import { openSession } from '#cli/commands/session.ts';
import { type Command } from '@commander-js/extra-typings';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { RECORD_FIELDS } from '#cli/config/settings/file.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import { findSettingSchema } from '#cli/settings/schema/gspot-toml.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { type SettingDeclaration } from '#cli/types/settings/tables.ts';
import { setKey, addToList, findScopeTable } from '#cli/settings/edit.ts';
import type { Mutation, SettingsEdit } from '#cli/types/settings/file.ts';
import { DECIMAL, INTEGER, STRUCTURED } from '#cli/config/commands/set.ts';
import { isRecord, getValueAt, stripUndefined } from '#cli/system/values.ts';
import { saveSettings, startSettingsEdit } from '#cli/commands/save-settings.ts';
import { type SetOptions, type ParsedSettingValue } from '#cli/types/commands/save-settings.ts';
import { getSettingValue, getWrittenValue, findDeclaration, findSettingDefault } from '#cli/settings/inherit.ts';

import type {
    Settings,
    SettingEntry,
    KnownSettings,
    ScopeSelection,
    DeclarationMatch,
} from '#cli/types/settings/values.ts';

// Structured values use the inline syntax of gspot.toml.
function parseStructured(text: string): unknown {
    try {
        return parseTomlText(`value = ${text}`, 'value', 'settings')['value'];
    } catch {
        throw new GspotError(
            'settings',
            `The value ${text} is not a TOML inline value. Write a list as ["a", "b"] and a table as {key = "value"}, inside single quotes for the shell.`,
        );
    }
}

function parseItem(text: string): unknown {
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (INTEGER.test(text) || DECIMAL.test(text)) return Number(text);
    const isStructured = STRUCTURED.test(text);
    return isStructured ? parseStructured(text) : text;
}

function buildSettingError(settings: Settings, known: KnownSettings, key: string, reads: ReadCache): GspotError {
    const manifests = readManifests(reads);
    const selectedScope = Object.keys(settings.scope).find(
        (scope) =>
            findDeclaration(buildKnownSettings(selectForScope(settings, scope, manifests), settings.level), key) !==
            undefined,
    );
    if (selectedScope !== undefined)
        return new GspotError(
            'arguments',
            `A configuration has the setting \`${key}\` in the scope \`${selectedScope}\`; add --scope ${quoteArgument(selectedScope)}.`,
        );
    return new GspotError('arguments', formatUnknownSetting(known, key));
}

function parseSettingValue(items: string[], declaration: SettingDeclaration): ParsedSettingValue {
    const parsed = items.map((item) => parseItem(item));
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

function describeSet(
    settings: Settings,
    known: KnownSettings,
    options: SetOptions,
    label: string,
    value: unknown,
    isList: boolean,
): string {
    const previous = getSettingValue(known, settings, options.key, options.scope);
    const reason = options.reason === undefined ? '' : `  # ${options.reason}`;
    const was = previous === undefined ? '' : `  (was ${JSON.stringify(previous.value)} from ${previous.source})`;
    const items = JSON.stringify(value);
    const change = isList ? `added to ${label}: ${items}` : `${label} = ${items}`;
    return `${change}${reason}${was}`;
}

async function changeSetting(
    root: string,
    input: SettingsEdit,
    settings: Settings,
    known: KnownSettings,
    options: SetOptions,
    declaration: SettingDeclaration,
    shown: string,
): Promise<CommandResult> {
    const change = parseSettingValue(options.items, declaration);
    const isList = change.type === 'list';
    const previous = getSettingValue(known, settings, options.key, options.scope);
    if (
        isList &&
        options.reason === undefined &&
        previous?.reason !== undefined &&
        isLoosening(
            declaration,
            change.value,
            findSettingDefault(
                known,
                findDeclaration(known, options.key) as DeclarationMatch,
                options.scope ?? '',
                (dependentKey) => (getSettingValue(known, settings, dependentKey, options.scope) as SettingEntry).value,
            )?.value,
        )
    )
        throw new GspotError(
            'settings',
            `${options.key} already has the reason ${JSON.stringify(previous.reason)}. Pass --reason with a reason that covers every item.`,
        );
    const mutation: Mutation = (written) => {
        const scopeTable = findScopeTable(written, options.scope);
        if (change.type === 'list') addToList(scopeTable, options.key, change.value);
        else if (declaration.type === 'table' && isRecord(change.value)) {
            const written = getValueAt(scopeTable, options.key.split('.'));
            const existing = getWrittenValue(written);
            setKey(scopeTable, options.key, { ...(isRecord(existing) ? existing : {}), ...change.value });
        } else setKey(scopeTable, options.key, change.value);
        if (options.reason !== undefined) {
            const written = getValueAt(scopeTable, options.key.split('.'));
            const value = getWrittenValue(written);
            setKey(scopeTable, options.key, { value, reason: options.reason });
        }
    };
    const summary = describeSet(settings, known, options, shown, change.value, isList);
    return await saveSettings(root, { input, change: mutation, summary });
}

/**
 * Writes a setting, adds list items, or changes table entries.
 * @param options the parsed flags
 * @returns the command result
 */
async function setCommand(options: SetOptions): Promise<CommandResult> {
    if (['configurations', 'removed_configurations'].includes(options.key))
        throw new GspotError('arguments', 'Use gspot add or gspot remove to change configurations.');
    if (Object.hasOwn(RECORD_FIELDS, options.key))
        throw new GspotError(
            'arguments',
            `Write [[${options.key}]] by hand in gspot.toml. Record lists have their own fields.`,
        );
    const { root, input } = await startSettingsEdit(options.cwd);
    const reads = createReadCache(root);
    const settings = parseSettings(input.text, root, reads);
    findScopeTable(input.table, options.scope);
    const session = await openSession(root, { settings, text: input.text }, { reads });
    const known = (session.scopes.find((selection) => selection.scope.path === (options.scope ?? '')) as ScopeSelection)
        .known;
    const match = findDeclaration(known, options.key);
    if (!match) throw buildSettingError(settings, known, options.key, session.reads);
    const shown = options.scope === undefined ? options.key : `scope.${options.scope}.${options.key}`;
    return await changeSetting(root, input, settings, known, options, match.declaration, shown);
}

/**
 * Register the set command.
 * @param program the command program
 */
export function registerSet(program: Command): void {
    program
        .command('set')
        .argument('<setting>', COMMAND_HELP.set.arguments['setting'])
        .argument('<values...>', COMMAND_HELP.set.arguments['values'])
        .summary(COMMAND_HELP.set.summary)
        .description(COMMAND_HELP.set.description)
        .option('--reason <text>', COMMAND_HELP.set.options['--reason <text>'])
        .option('--scope <path>', COMMAND_HELP.set.options['--scope <path>'], trimTrailingSlashes)
        .action(async (setting, items, flags) => {
            printResult(
                await setCommand({
                    cwd: process.cwd(),
                    key: setting,
                    items,
                    ...stripUndefined({ reason: flags.reason, scope: flags.scope }),
                }),
            );
        });
}

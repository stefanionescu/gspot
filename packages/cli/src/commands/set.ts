import { parse } from '@decimalturn/toml-patch';

import { readSettingsEditContext, selectSettingToEdit, writeSettingsEdit } from '#cli/commands/edits.ts';
import { BOOLEAN_WORDS, NUMBER_TEXT, TOML_COMPOUND_START, TOML_QUOTES } from '#cli/config/commands/edits.ts';
import { REASON_OPTION, SCOPE_OPTION } from '#cli/config/commands/help.ts';
import { WEAKENING_RULES } from '#cli/config/configurations/structure.ts';
import { readCheckRuleExplanation } from '#cli/configurations/rules.ts';
import { isSettingEmpty, isSettingUnread } from '#cli/engine/skips.ts';
import { listChecksById, readConfigurations } from '#cli/manifests/read.ts';
import { setKey } from '#cli/settings/edit.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { findSettingDefault, getSettingValue } from '#cli/settings/inherit.ts';
import { findNamingParent, findSettingSchema } from '#cli/settings/lookup.ts';
import { joinSettingPaths } from '#cli/settings/paths.ts';
import { formatSettingValueError } from '#cli/settings/validation/messages.ts';
import { isWeakening } from '#cli/settings/validation/reasons.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findValueAt, isTable } from '#cli/system/tables.ts';
import { formatNameList } from '#cli/system/text.ts';
import { findToolName } from '#cli/tools/pins.ts';
import { canReadRuleExplanations } from '#cli/tools/rules.ts';
import type {
    CommandDefinition,
    ParsedSettingValue,
    ReasonFlags,
    SetOptions,
    SettingReasonContext,
    SettingsEditContext,
} from '#cli/types/commands/edits.ts';
import type { Check, Setting } from '#cli/types/manifests.ts';
import type { InheritedSetting, TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';

const PREVIOUS_VALUE_LENGTH = 80;

const TOOL_RULES_KEY = /^tools\.(?<tool>[^.]+)\.rules$/u;

// These keys hold no reason, so the record of why they changed is an ignore of the weakening that the change reports.
const REASON_IGNORE_RULES: Readonly<Record<string, string>> = {
    level: WEAKENING_RULES.level,
    'hooks.enabled': WEAKENING_RULES.hooks,
    'rule_files.enabled': WEAKENING_RULES.ruleFiles,
    'rule_files.exclude': WEAKENING_RULES.ruleFiles,
};

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

function formatMissingReason({ options, change, previous }: SettingReasonContext): string {
    const { key } = options;
    if (change.type === 'list' && previous?.reason !== undefined)
        return `${key} already has the reason ${JSON.stringify(previous.reason)}. Pass --reason with a reason that covers every item.`;
    return `${JSON.stringify(change.value)} is weaker than the shipped default of ${key}, so it needs a reason. Add --reason "<why>".`;
}

function assertReason(context: SettingReasonContext): void {
    const { options, setting, joined, shippedDefault } = context;
    if (setting.reason_values === true) return;
    if (options.reason === undefined) {
        if (isWeakening(setting, joined, shippedDefault))
            throw new GspotError('arguments', formatMissingReason(context));
        return;
    }
    if (setting.reasoned === true) return;
    const rule = REASON_IGNORE_RULES[options.key];
    const ignore = rule === undefined ? '' : `, then gspot ignore gspot/weakenings --rule ${rule} --reason "<why>"`;
    throw new GspotError('arguments', `${options.key} holds no reason. Run the command without --reason${ignore}.`);
}

function formatPreviousValue(previous: InheritedSetting | undefined): string {
    if (previous?.value === undefined) return '';
    const text = JSON.stringify(previous.value);
    const shown = text.length > PREVIOUS_VALUE_LENGTH ? `${text.slice(0, PREVIOUS_VALUE_LENGTH)}...` : text;
    return `  (was ${shown} from ${previous.source})`;
}

function formatSettingChange(
    change: ParsedSettingValue,
    context: {
        setting: Setting;
        options: SetOptions;
        scopePath: string;
        previous: InheritedSetting | undefined;
    },
): string {
    const { setting, options, scopePath, previous } = context;
    const displayKey = options.key;
    const where = scopePath === '' ? '' : ` in scope ${scopePath}`;
    const was = formatPreviousValue(previous);
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
    const parent = findNamingParent(options.key);
    if (parent !== undefined)
        throw new GspotError(
            'arguments',
            `${options.key} takes its value from ${parent}. Run gspot set ${parent} <value>.`,
        );
    const change: ParsedSettingValue =
        setting.reason_values === true
            ? {
                  type: 'scalar',
                  value: Object.fromEntries(options.values.map((name) => [name, requireReason(options)])),
              }
            : parseSettingValue(options.values, setting);
    const previous = getSettingValue(availableSettings, settings, options.key, edit.scopePath);
    const shippedDefault = findSettingDefault(availableSettings, settings, match, edit.scopePath)?.value;
    const joined = joinSettingPaths(options.key, change.value, edit.scopePath);
    assertReason({ options, setting, change, joined, previous, shippedDefault });
    const notes = isSettingUnread(settings, scope, options.key)
        ? [`No selected check reads ${options.key} at level ${settings.level}.`]
        : [];
    const summary = formatSettingChange(change, { setting, options, scopePath: edit.scopePath, previous });
    return { setting, change, summary, notes };
}

function findRulesCheck(edit: SettingsEditContext, key: string, change: ParsedSettingValue): Check | undefined {
    const tool = TOOL_RULES_KEY.exec(key)?.groups?.['tool'];
    if (tool === undefined || !isTable(change.value)) return undefined;
    const plugins = `tools.${tool}.plugins`;
    if (edit.session.scopes.some(({ settings }) => !isSettingEmpty(settings.valuesByKey[plugins]))) return undefined;
    const owners = listChecksById(readConfigurations().values()).values();
    return owners.find(({ check }) => findToolName(check)?.startsWith(tool))?.check;
}

async function assertLintRules(edit: SettingsEditContext, key: string, change: ParsedSettingValue): Promise<void> {
    const check = findRulesCheck(edit, key, change);
    const tool = check === undefined ? undefined : findToolName(check);
    if (check === undefined || tool === undefined) return;
    const { session } = edit;
    for (const rule of Object.keys(change.value as TomlTable)) {
        if (!canReadRuleExplanations(tool, rule)) continue;
        const docs = await readCheckRuleExplanation(session.root, check, rule, session).catch((error: unknown) => {
            if (error instanceof GspotError) return { unread: true };
            throw error;
        });
        if (docs === undefined) throw new GspotError('arguments', `gspot does not know rule ${rule} of ${check.id}.`);
    }
}

async function runSetCommand(options: SetOptions): Promise<CommandResult> {
    const edit = await readSettingsEditContext(options, options.scopePath);
    const { scopeTable } = edit;
    const { setting, change, summary, notes } = buildSettingChange(edit, options);
    await assertLintRules(edit, options.key, change);
    setSetting(scopeTable, change, setting, options);
    return await writeSettingsEdit(edit, { summary, notes });
}

export const SET_COMMAND: CommandDefinition<[string, string[]], ReasonFlags> = {
    name: 'set',
    arguments: [{ term: '<setting>' }, { term: '<values...>' }],
    options: [{ flags: REASON_OPTION }, { flags: SCOPE_OPTION }],
    run: async ({ arguments: commandArguments, flags: { reason, scope: scopePath }, root, cwd }) => {
        const [key, values] = commandArguments;
        return await runSetCommand({ root, cwd, key, values, reason, scopePath });
    },
};

import { readSettingsEditContext, selectSettingToEdit, writeSettingsEdit } from '#cli/commands/edits.ts';
import {
    ENTRY_REASON_MESSAGE,
    PREVIOUS_VALUE_LENGTH,
    REASON_IGNORE_RULES,
    TOOL_RULES_KEY,
} from '#cli/config/commands/edits.ts';
import { REASON_OPTION, SCOPE_OPTION } from '#cli/config/commands/help.ts';
import { readListedRuleExplanation } from '#cli/configurations/lint-rules.ts';
import { isSettingUnread } from '#cli/engine/plan/skips.ts';
import { readShippedChecks } from '#cli/manifests/checks.ts';
import { findToolName } from '#cli/manifests/tools.ts';
import { findNamingParent } from '#cli/settings/lookup.ts';
import { parseSettingValue } from '#cli/settings/parse.ts';
import { setSetting } from '#cli/settings/toml/edit.ts';
import { isWeakening } from '#cli/settings/validation/reasons.ts';
import { findSettingDefault, formatSettingSource, getSettingValue } from '#cli/settings/values/inherit.ts';
import { joinSettingPaths } from '#cli/settings/values/paths.ts';
import { isSettingEmpty } from '#cli/settings/values/written.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isTable } from '#cli/system/tables.ts';
import { formatNameList } from '#cli/system/text/messages.ts';
import type {
    CommandDefinition,
    ReasonFlags,
    SetOptions,
    SettingReasonContext,
    SettingsEditContext,
} from '#cli/types/commands.ts';
import type { Check } from '#cli/types/manifests.ts';
import type { InheritedSetting, ParsedSettingValue, Setting, TomlTable } from '#cli/types/settings.ts';
import type { CommandResult } from '#cli/types/system.ts';

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
    return `  (was ${shown} from ${formatSettingSource(previous.origin, previous.writtenAs)})`;
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
    if (setting.reason_values === true && options.reason === undefined)
        throw new GspotError(
            'arguments',
            ENTRY_REASON_MESSAGE.replace('{key}', () => options.key),
        );
    const change: ParsedSettingValue =
        setting.reason_values === true
            ? { type: 'scalar', value: Object.fromEntries(options.values.map((name) => [name, options.reason])) }
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
    const owners = readShippedChecks().values();
    return owners.find(({ check }) => findToolName(check)?.startsWith(tool))?.check;
}

async function assertLintRules(edit: SettingsEditContext, key: string, change: ParsedSettingValue): Promise<void> {
    const check = findRulesCheck(edit, key, change);
    if (check === undefined) return;
    const { session } = edit;
    for (const rule of Object.keys(change.value as TomlTable))
        await readListedRuleExplanation(session.root, check, rule, session);
}

async function runSetCommand(options: SetOptions): Promise<CommandResult> {
    const edit = await readSettingsEditContext(options);
    const { scopeTable } = edit;
    const { setting, change, summary, notes } = buildSettingChange(edit, options);
    await assertLintRules(edit, options.key, change);
    setSetting(scopeTable, change, setting, options);
    return await writeSettingsEdit(edit, { summary, notes });
}

export const SET_COMMAND: CommandDefinition<[string, string[]], ReasonFlags, Omit<SetOptions, 'root'>> = {
    name: 'set',
    arguments: [{ term: '<setting>' }, { term: '<values...>' }],
    options: [{ flags: REASON_OPTION }, { flags: SCOPE_OPTION }],
    parse: ({ arguments: commandArguments, flags: { reason, scope: scopePath }, cwd }) => {
        const [key, values] = commandArguments;
        return { cwd, key, values, reason, scopePath };
    },
    run: runSetCommand,
};

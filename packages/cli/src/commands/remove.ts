import { GspotError } from '#cli/system/errors.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { buildSettings } from '#cli/settings/read.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { removeKey, getScopeTable } from '#cli/settings/edit.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/generation/write.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { listDetectedAdditions } from '#cli/repository/configurations.ts';
import { SCOPE_OPTION, REASON_OPTION } from '#cli/config/commands/flags.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import type { ConfigurationsOptions } from '#cli/types/generation/settings-edit.ts';
import { GSPOT_REMOVE, REMOVE_CONFIGURATION_MESSAGE } from '#cli/config/commands/remove.ts';
import { findSetting, listWrittenKeys, listSettingsTables } from '#cli/settings/inherit.ts';
import { applySettingsEdit, prepareConfigurationEdit } from '#cli/generation/settings-edit.ts';

function assertRemovable(names: string[], kept: string[], configurationsByName: Map<string, Configuration>): void {
    for (const configuration of names) {
        const chain = kept
            .map((name) => findRequirementChain(configuration, name, configurationsByName))
            .find((found) => found !== undefined);
        if (chain)
            throw new GspotError(
                'arguments',
                `Cannot remove ${configuration}: ${chain.join(' requires ')}. Remove ${chain[0] as string} first, or keep ${configuration}.`,
            );
    }
}

function formatConfigurationChange(changed: string[], unchanged: string[], where: string): string {
    let summary = `Removed ${new Intl.ListFormat('en', { type: 'conjunction' }).format(changed)}${where}.`;
    if (unchanged.length > 0)
        summary += ` ${new Intl.ListFormat('en', { type: 'conjunction' }).format(unchanged)} ${unchanged.length === 1 ? 'was' : 'were'} not selected.`;
    return summary;
}

function removeUnusedSettings(
    table: TomlTable,
    configurationsByName: Map<string, Configuration>,
    scopePath: string,
): string {
    const edited = buildSettings(settingsSchema.parse(table), table);
    const general = configurationsByName
        .values()
        .filter((configuration) => configuration.group === 'general')
        .toArray();
    const removed: string[] = [];
    const affected = listSettingsTables(edited).filter((written) => isInScope(written.scope, scopePath));
    for (const written of affected) {
        const selected = selectForScope(edited, written.scope, configurationsByName);
        const available = buildAvailableSettings([...general, ...selected], edited.level);
        const keys = listWrittenKeys(written.table, available).filter(
            (key) => findSetting(available, key) === undefined,
        );
        for (const key of keys) removeKey(getScopeTable(table, written.scope), key);
        removed.push(...keys.map((key) => (written.scope === '' ? key : `${key} (scope ${written.scope})`)));
    }
    return removed.length === 0 ? '' : ` Removed settings ${removed.join(', ')}.`;
}

function formatRemovedReason(previous: unknown, reason: string, scope: string): string {
    if (!isReasonedValue(previous) || previous.reason === reason) return '';
    const where = scope === '' ? '' : ' in scope ' + scope;
    return ` Updated the reason for every removed configuration${where}.`;
}

async function runRemoveCommand(options: ConfigurationsOptions & { reason: string }): Promise<CommandResult> {
    const {
        root,
        input,
        scope,
        scopeTable,
        scopeSettings,
        selected: selectedNames,
        configurationsByName,
        context,
    } = await prepareConfigurationEdit(options);
    const detected = listDetectedAdditions(context.session)
        .filter((addition) => addition.scope === scope)
        .flatMap((addition) => addition.configurations);
    const selected = [...new Set([...selectedNames, ...detected])];
    const kept = selected.filter((name) => !options.configurations.includes(name));
    assertRemovable(options.configurations, kept, configurationsByName);
    if (options.configurations.every((name) => !selected.includes(name))) {
        const summary = `No change: ${new Intl.ListFormat('en', { type: 'conjunction' }).format(options.configurations)} ${options.configurations.length === 1 ? 'is' : 'are'} not selected.`;
        return {
            text: summary + '\n',
            json: { changed: false, summary },
            exitCode: 0,
        };
    }
    const previous = scopeTable['removed_configurations'];
    const scopeConfigurations = scopeSettings.configurations;
    const removed = options.configurations.filter((name) => selected.includes(name));
    scopeTable['configurations'] = scopeConfigurations.filter((name) => !removed.includes(name));
    scopeTable['removed_configurations'] = {
        value: [...new Set([...scopeSettings.removed_configurations, ...removed])],
        reason: options.reason,
    };
    const where = scope === '' ? '' : ` from scope ${scope}`;
    const unchanged = options.configurations.filter((name) => !selected.includes(name));
    const summary =
        formatConfigurationChange(removed, unchanged, where) +
        removeUnusedSettings(input.table, configurationsByName, scope) +
        formatRemovedReason(previous, options.reason, scope);
    const ownsManagedKeys = configurationsByName
        .values()
        .filter((configuration) => removed.includes(configuration.name))
        .flatMap((configuration) => configuration.tools)
        .some((tool) => tool.replace_key?.some((replacement) => replacement.pointer === true) === true);
    return applySettingsEdit(root, {
        reads: context.reads,
        listing: context.listing,
        edit: input,
        summary,
        notes: ownsManagedKeys ? [MANAGED_KEYS_NOTE] : [],
    });
}

function findRequirementChain(
    required: string,
    from: string,
    configurationsByName: Map<string, Configuration>,
): string[] | undefined {
    const seen = new Set<string>();
    function findChain(start: string): string[] | undefined {
        if (start === required) return [start];
        if (seen.has(start)) return undefined;
        seen.add(start);
        const requirements = configurationsByName.get(start)?.requires ?? [];
        for (const next of requirements) {
            const rest = findChain(next);
            if (rest !== undefined) return [start, ...rest];
        }
        return undefined;
    }
    return findChain(from);
}

/**
Register the remove command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
export function registerRemove(program: Command, onResult: CommandCompletion): void {
    program
        .command('remove')
        .argument('<configuration...>', COMMAND_HELP.remove.arguments['configuration'])
        .summary(COMMAND_HELP.remove.summary)
        .description(COMMAND_HELP.remove.description)
        .requiredOption(REASON_OPTION, COMMAND_HELP.remove.options[REASON_OPTION])
        .option(SCOPE_OPTION, COMMAND_HELP.remove.options[SCOPE_OPTION], stripTrailingSlashes)
        .action(async (configurations, flags) => {
            const invalid = validateReason(GSPOT_REMOVE, flags.reason, REMOVE_CONFIGURATION_MESSAGE);
            if (invalid !== undefined) throw new GspotError('arguments', invalid);
            onResult(
                await runRemoveCommand({
                    cwd: process.cwd(),
                    configurations: [...new Set(configurations)],
                    reason: flags.reason,
                    ...stripUndefined({ scope: flags.scope }),
                }),
            );
        });
}

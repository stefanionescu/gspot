import { GspotError } from '#cli/system/errors.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { buildSettings } from '#cli/settings/read.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { type Command } from '@commander-js/extra-typings';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { isTable, stripUndefined } from '#cli/system/tables.ts';
import { deleteKey, getScopeTable } from '#cli/settings/edit.ts';
import { type ConfigurationsOptions } from '#cli/types/apply.ts';
import { type Configuration } from '#cli/types/configurations.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { applySettingsEdit, prepareConfigurationEdit } from '#cli/apply/settings.ts';
import { findSetting, listWrittenKeys, listSettingsTables } from '#cli/settings/inherit.ts';

function assertNotRequired(names: string[], kept: string[], configurations: Map<string, Configuration>): void {
    for (const configuration of names) {
        const chain = kept
            .map((name) => findRequirementChain(configuration, name, configurations))
            .find((found) => found !== undefined);
        if (chain)
            throw new GspotError(
                'arguments',
                `Cannot remove ${configuration}: ${chain.join(' requires ')}. Remove ${chain[0] as string} first, or keep ${configuration}.`,
            );
    }
}

function formatConfigurationChange(changed: string[], unchanged: string[], where: string): string {
    let summary = `Removed ${changed.join(' and ')}${where}.`;
    if (unchanged.length > 0)
        summary += ` ${unchanged.join(' and ')} ${unchanged.length === 1 ? 'was' : 'were'} not selected.`;
    return summary;
}

function removeUnusedSettings(context: ReturnType<typeof prepareConfigurationEdit>, scope: string | undefined): string {
    const { input, configurations } = context;
    const edited = buildSettings(settingsSchema.parse(input.table), input.table);
    const general = [...configurations.values()].filter((configuration) => configuration.group === 'general');
    const removed: string[] = [];
    const affected = listSettingsTables(edited).filter((table) => isInScope(table.scope ?? '', scope ?? ''));
    for (const table of affected) {
        const selected = selectForScope(edited, table.scope ?? '', configurations);
        const available = buildAvailableSettings([...general, ...selected], edited.level);
        const keys = listWrittenKeys(table.table, available).filter((key) => findSetting(available, key) === undefined);
        for (const key of keys) deleteKey(getScopeTable(input.table, table.scope), key);
        removed.push(...keys.map((key) => (table.scope === undefined ? key : `${key} (scope ${table.scope})`)));
    }
    return removed.length === 0 ? '' : ` Removed settings ${removed.join(', ')}.`;
}

async function runRemoveCommand(options: ConfigurationsOptions & { reason: string }): Promise<CommandResult> {
    const context = prepareConfigurationEdit(options);
    const { root, input, scopeSettings, selected, configurations } = context;
    const kept = selected.filter((name) => !options.configurations.includes(name));
    assertNotRequired(options.configurations, kept, configurations);
    if (!options.configurations.some((name) => selected.includes(name))) {
        return {
            text: `No change: ${options.configurations.join(' and ')} ${options.configurations.length === 1 ? 'is' : 'are'} not selected.\n`,
            json: { changed: false },
            exitCode: 0,
        };
    }
    const scopeConfigurations = scopeSettings.configurations;
    const scopeTable = getScopeTable(input.table, options.scope);
    const removed = options.configurations.filter((name) => selected.includes(name));
    scopeTable['configurations'] = scopeConfigurations.filter((name) => !removed.includes(name));
    const previous = scopeTable['removed_configurations'];
    if (isTable(previous) && previous['reason'] !== options.reason)
        throw new GspotError(
            'arguments',
            `removed_configurations already has the reason ${JSON.stringify(previous['reason'])}. Pass --reason with a reason that covers every item.`,
        );
    scopeTable['removed_configurations'] = {
        value: [...new Set([...scopeSettings.removed_configurations, ...removed])],
        reason: options.reason,
    };
    const where = options.scope === undefined ? '' : ` from scope ${options.scope}`;
    const unchanged = options.configurations.filter((name) => !selected.includes(name));
    const summary = formatConfigurationChange(removed, unchanged, where) + removeUnusedSettings(context, options.scope);
    return applySettingsEdit(root, {
        edit: input,
        summary,
    });
}

function findRequirementChain(
    required: string,
    from: string,
    configurations: Map<string, Configuration>,
): string[] | undefined {
    const seen = new Set<string>();
    function findChain(start: string): string[] | undefined {
        if (start === required) return [start];
        if (seen.has(start)) return undefined;
        seen.add(start);
        for (const required of configurations.get(start)?.requires ?? []) {
            const rest = findChain(required);
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
        .option('--reason <text>', COMMAND_HELP.remove.options['--reason <text>'])
        .option('--scope <path>', COMMAND_HELP.remove.options['--scope <path>'], trimTrailingSlashes)
        .action(async (configurations, flags) => {
            if (flags.reason === undefined) throw new GspotError('arguments', 'gspot remove needs --reason "<why>".');
            const invalid = validateReason(
                'gspot remove',
                flags.reason,
                'Run gspot remove <configuration> --reason "<why>".',
            );
            if (invalid !== undefined) throw new GspotError('arguments', invalid);
            onResult(
                await runRemoveCommand({
                    cwd: process.cwd(),
                    configurations,
                    reason: flags.reason,
                    ...stripUndefined({ scope: flags.scope }),
                }),
            );
        });
}

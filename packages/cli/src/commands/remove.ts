import { GspotError } from '#cli/system/errors.ts';
import { getScopeTable } from '#cli/settings/edit.ts';
import { type Command } from '@commander-js/extra-typings';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { isTable, stripUndefined } from '#cli/system/tables.ts';
import { type ConfigurationsOptions } from '#cli/types/apply.ts';
import { type Configuration } from '#cli/types/configurations.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { applySettingsEdit, prepareConfigurationEdit } from '#cli/apply/settings-edit.ts';

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

/**
 * Remove configurations from the root list or from the list of one scope.
 *
 * @param options the parsed flags.
 * @returns the command result.
 */
async function runRemoveCommand(options: ConfigurationsOptions & { reason: string }): Promise<CommandResult> {
    const { root, input, scopeSettings, selected, configurations } = prepareConfigurationEdit(options);
    const kept = selected.filter((name) => !options.configurations.includes(name));
    assertNotRequired(options.configurations, kept, configurations);
    if (!options.configurations.some((name) => selected.includes(name))) {
        return {
            text: `No change: ${options.configurations.join(' and ')} ${options.configurations.length === 1 ? 'is' : 'are'} not selected.\n`,
            json: { changed: false },
            exitCode: 0,
        };
    }
    const current = scopeSettings.configurations;
    const scopeTable = getScopeTable(input.table, options.scope);
    const removed = options.configurations.filter((name) => selected.includes(name));
    scopeTable['configurations'] = current.filter((name) => !removed.includes(name));
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
    const summary = `Removed ${options.configurations.join(' and ')}${where}.`;
    return applySettingsEdit(root, {
        edit: input,
        summary,
    });
}

/**
 * Find the chain of requirements from one configuration to another, and visit each one once.
 *
 * @param required the required configuration.
 * @param from the configuration where the chain starts.
 * @param configurations every configuration.
 * @returns the names along the chain, or undefined when no chain exists.
 */
function findRequirementChain(
    required: string,
    from: string,
    configurations: Map<string, Configuration>,
): string[] | undefined {
    const seen = new Set<string>();
    function findChain(current: string): string[] | undefined {
        if (current === required) return [current];
        if (seen.has(current)) return undefined;
        seen.add(current);
        for (const required of configurations.get(current)?.requires ?? []) {
            const rest = findChain(required);
            if (rest !== undefined) return [current, ...rest];
        }
        return undefined;
    }
    return findChain(from);
}

/**
 * Register the remove command.
 *
 * @param program the gspot program that gets the command.
 * @param onResult receives the result of the command.
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
            const invalid = validateReason('gspot remove', flags.reason);
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

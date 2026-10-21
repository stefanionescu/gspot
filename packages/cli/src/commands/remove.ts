import { GspotError } from '#cli/system/errors.ts';
import { findScopeTable } from '#cli/settings/edit.ts';
import { type Command } from '@commander-js/extra-typings';
import { saveSettings } from '#cli/apply/save-settings.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import { isRecord, stripUndefined } from '#cli/system/values.ts';
import { startConfigurationEdit } from '#cli/commands/settings.ts';
import { validateReason } from '#cli/settings/validation/reasons.ts';
import { type ConfigurationsOptions } from '#cli/types/commands/settings.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';

function refuseRequirements(configurations: string[], kept: string[], manifests: Map<string, Manifest>): void {
    for (const configuration of configurations) {
        const chain = kept
            .map((id) => findRequirementChain(configuration, id, manifests))
            .find((found) => found !== undefined);
        if (chain)
            throw new GspotError(
                'arguments',
                `Cannot remove \`${configuration}\`: ${chain.join(' requires ')}. Remove \`${chain[0] as string}\` first, or keep \`${configuration}\`.`,
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
    const { root, input, scopeSettings, selected, manifests } = startConfigurationEdit(options);
    const kept = selected.filter((id) => !options.configurations.includes(id));
    refuseRequirements(options.configurations, kept, manifests);
    if (!options.configurations.some((name) => selected.includes(name))) {
        return {
            text: `No change: ${options.configurations.join(' and ')} ${options.configurations.length === 1 ? 'is' : 'are'} not selected.\n`,
            json: { changed: false },
            exitCode: 0,
        };
    }
    const current = scopeSettings.configurations;
    const scopeTable = findScopeTable(input.table, options.scope);
    const removed = options.configurations.filter((id) => selected.includes(id));
    scopeTable['configurations'] = current.filter((id) => !removed.includes(id));
    const previous = scopeTable['removed_configurations'];
    if (isRecord(previous) && previous['reason'] !== options.reason)
        throw new GspotError(
            'arguments',
            `removed_configurations already has the reason ${JSON.stringify(previous['reason'])}. Pass --reason with a reason that covers every item.`,
        );
    scopeTable['removed_configurations'] = {
        value: [...new Set([...scopeSettings.removed_configurations, ...removed])],
        reason: options.reason,
    };
    const where = options.scope === undefined ? '' : ` from scope ${options.scope}`;
    const description = `Removed ${options.configurations.join(' and ')}${where}.`;
    return saveSettings(root, {
        input,
        summary: description,
    });
}

/**
 * Register the remove command.
 *
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
function registerRemove(program: Command, onResult: CommandCompletion): void {
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
                    configurations: configurations,
                    reason: flags.reason,
                    ...stripUndefined({ scope: flags.scope }),
                }),
            );
        });
}

/**
 * Find the chain of requirements from one configuration to another, and visit each one once.
 *
 * @param target the required configuration.
 * @param from the configuration where the chain starts.
 * @param manifests every configuration manifest.
 * @returns the names along the chain, or undefined when no chain exists.
 */
function findRequirementChain(target: string, from: string, manifests: Map<string, Manifest>): string[] | undefined {
    const seen = new Set<string>();
    function findChain(current: string): string[] | undefined {
        if (current === target) return [current];
        if (seen.has(current)) return undefined;
        seen.add(current);
        for (const required of manifests.get(current)?.configuration.requires ?? []) {
            const rest = findChain(required);
            if (rest !== undefined) return [current, ...rest];
        }
        return undefined;
    }
    return findChain(from);
}

export { registerRemove };

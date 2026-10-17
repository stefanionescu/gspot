import { GspotError } from '#cli/system/errors.ts';
import { findScopeTable } from '#cli/settings/edit.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { type Command } from '@commander-js/extra-typings';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import type { Mutation } from '#cli/types/settings/edits.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { type ConfigurationsOptions } from '#cli/types/commands/edit-settings.ts';
import { saveSettings, startConfigurationEdit } from '#cli/apply/save-settings.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';

function formatUnselectedConfigurations(configurations: string[]): string {
    return `No change: ${configurations.join(' and ')} ${configurations.length === 1 ? 'is' : 'are'} not selected.\n`;
}

function buildRemovalEdit(
    scopeSettings: Pick<Settings, 'configurations' | 'removed_configurations'>,
    options: ConfigurationsOptions,
): Mutation {
    const current = scopeSettings.configurations;
    return (written) => {
        const scopeTable = findScopeTable(written, options.scope);
        const removed = options.configurations.filter((id) => current.includes(id));
        if (removed.length === 0) return;
        scopeTable['configurations'] = current.filter((id) => !removed.includes(id));
        scopeTable['removed_configurations'] = [...new Set([...scopeSettings.removed_configurations, ...removed])];
    };
}

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
 * @param options the parsed flags.
 * @returns the command result.
 */
async function runRemoveCommand(options: ConfigurationsOptions): Promise<CommandResult> {
    const { root, input, settings, manifests } = startConfigurationEdit(options.cwd, options.configurations);
    findScopeTable(input.table, options.scope);
    const scopeSettings =
        options.scope === undefined ? settings : (settings.scopes[options.scope] as Settings['scopes'][string]);
    const current = scopeSettings.configurations;
    const rootConfigurations = settings.configurations;
    const kept = [...new Set([...rootConfigurations, ...current])].filter((id) => !options.configurations.includes(id));
    refuseRequirements(options.configurations, kept, manifests);
    if (!options.configurations.some((name) => current.includes(name))) {
        return {
            text: formatUnselectedConfigurations(options.configurations),
            json: { changed: false },
            exitCode: 0,
        };
    }
    const removeConfigurations = buildRemovalEdit(scopeSettings, options);
    const where = options.scope === undefined ? '' : ` from scope ${options.scope}`;
    const description = `Removed ${options.configurations.join(' and ')}${where}.`;
    const result = await saveSettings(root, {
        input,
        change: removeConfigurations,
        summary: description,
    });
    return result.exitCode === 0 && !result.json.changed
        ? {
              ...result,
              text: formatUnselectedConfigurations(options.configurations),
          }
        : result;
}

/**
 * Register the remove command.
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
function registerRemove(program: Command, onResult: CommandCompletion): void {
    program
        .command('remove')
        .argument('<configuration...>', COMMAND_HELP.remove.arguments['configuration'])
        .summary(COMMAND_HELP.remove.summary)
        .description(COMMAND_HELP.remove.description)
        .option('--scope <path>', COMMAND_HELP.remove.options['--scope <path>'], trimTrailingSlashes)
        .action(async (configurations, flags) => {
            onResult(
                await runRemoveCommand({
                    cwd: process.cwd(),
                    configurations: configurations,
                    ...stripUndefined({ scope: flags.scope }),
                }),
            );
        });
}

/**
 * Find the chain of requirements from one configuration to another, and visit each one once.
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

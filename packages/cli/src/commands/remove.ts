import { GspotError } from '#cli/system/errors.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { printResult } from '#cli/system/terminal.ts';
import { findScopeTable } from '#cli/settings/edit.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { type Command } from '@commander-js/extra-typings';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { Mutation } from '#cli/types/settings/file.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { type ConfigurationsOptions } from '#cli/types/commands/save-settings.ts';
import { saveSettings, startSettingsEdit, refuseAlwaysSelected } from '#cli/commands/save-settings.ts';

/**
 * gspot remove: drops configurations from the root list or from one scope's list.
 * @param options the parsed flags
 * @returns the command result
 */
async function removeCommand(options: ConfigurationsOptions): Promise<CommandResult> {
    const { root, input } = await startSettingsEdit(options.cwd);
    parseSettings(input.text, root);
    const manifests = readManifests(createReadCache(root));
    refuseAlwaysSelected(options.configurations, manifests);
    const written = findScopeTable(input.table, options.scope);
    const current = settingsSchema.shape.configurations.parse(written['configurations']);
    const rootConfigurations = settingsSchema.shape.configurations.parse(input.table['configurations']);
    const kept = [...new Set([...rootConfigurations, ...current])].filter((id) => !options.configurations.includes(id));
    for (const configuration of options.configurations) {
        const chain = kept.map((id) => requireChain(configuration, id, manifests)).find((found) => found !== undefined);
        if (chain)
            throw new GspotError(
                'arguments',
                `Cannot remove \`${configuration}\`: ${chain.join(' requires ')}. Remove \`${chain[0] as string}\` first, or keep \`${configuration}\`.`,
            );
    }
    if (!options.configurations.some((name) => current.includes(name))) {
        return { text: 'nothing to remove\n', json: { changed: false }, exitCode: 0 };
    }
    const mutation: Mutation = (written) => {
        const scopeTable = findScopeTable(written, options.scope);
        const list = settingsSchema.shape.configurations.parse(scopeTable['configurations']);
        const removed = options.configurations.filter((id) => list.includes(id));
        if (removed.length === 0) return;
        scopeTable['configurations'] = list.filter((id) => !removed.includes(id));
        scopeTable['removed_configurations'] = [
            ...new Set([
                ...settingsSchema.shape.removed_configurations.parse(scopeTable['removed_configurations']),
                ...removed,
            ]),
        ];
    };
    const where = options.scope === undefined ? '' : ` from scope ${options.scope}`;
    const description = `removed ${options.configurations.join(', ')}${where}`;
    const result = await saveSettings(root, {
        input,
        change: mutation,
        summary: description,
    });
    return result.exitCode === 0 && !result.json.changed ? { ...result, text: 'nothing to remove\n' } : result;
}

/**
 * Register the remove command.
 * @param program the command program
 */
function registerRemove(program: Command): void {
    program
        .command('remove')
        .argument('<configuration...>', COMMAND_HELP.remove.arguments['configuration'])
        .summary(COMMAND_HELP.remove.summary)
        .description(COMMAND_HELP.remove.description)
        .option('--scope <path>', COMMAND_HELP.remove.options['--scope <path>'], trimTrailingSlashes)
        .action(async (configurations, flags) => {
            printResult(
                await removeCommand({
                    cwd: process.cwd(),
                    configurations: configurations,
                    ...stripUndefined({ scope: flags.scope }),
                }),
            );
        });
}

/**
 * The chain of requirements from one configuration to another, without revisiting a declaration.
 * @param target the required configuration.
 * @param from the configuration the chain starts at.
 * @param manifests every configuration manifest.
 * @returns the configuration names along the chain from the starting configuration to the target, or undefined when no chain exists.
 */
function requireChain(target: string, from: string, manifests: Map<string, Manifest>): string[] | undefined {
    const seen = new Set<string>();
    function search(current: string): string[] | undefined {
        if (current === target) return [current];
        if (seen.has(current)) return undefined;
        seen.add(current);
        for (const required of manifests.get(current)?.configuration.requires ?? []) {
            const rest = search(required);
            if (rest !== undefined) return [current, ...rest];
        }
        return undefined;
    }
    return search(from);
}

export { registerRemove };

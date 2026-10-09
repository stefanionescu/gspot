// Remove authored configuration choices through the policy transaction.
import { compact } from '#cli/platform/contracts.ts';
import { GspotError } from '#cli/platform/public.ts';
import { printResult } from '#cli/terminal/public.ts';
import { savePolicy } from '#cli/commands/contracts.ts';
import { assertVersionPin } from '#cli/lifecycle/public.ts';
import { policySchema } from '#cli/policy/schema/public.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import type { Program } from '#cli/types/commands/program.ts';
import type { Mutation } from '#cli/types/policy/settings.ts';
import { defaultValue } from '#cli/policy/schema/contracts.ts';
import { findRoot } from '#cli/repository/discovery/contracts.ts';
import { commandHelp, commandRoot } from '#cli/commands/public.ts';
import type { RemoveOptions } from '#cli/types/commands/remove.ts';
import { getScopeTable, preparePolicy } from '#cli/policy/document/contracts.ts';
import { requireChain, configurationManifests } from '#cli/configurations/public.ts';

/**
 * gspot remove: drops configurations from the root list or from one scope's list.
 * @param options the parsed flags
 * @returns the command result
 */
async function removeCommand(options: RemoveOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const input = preparePolicy(root);
    assertVersionPin(root, input.table['runner']);
    const manifests = configurationManifests();
    const general = options.configurations.find((id) => manifests.get(id)?.configuration.kind === 'general');
    if (general !== undefined)
        throw new GspotError('policy', [
            `The ${general} configuration follows repository inputs and the selected level. Change coverage with gspot set level, or record a check exception with gspot ignore and a reason.`,
        ]);
    const mutation: Mutation = (raw) => {
        const holder = getScopeTable(raw, options.scope);
        const list = policySchema.shape.configurations.unwrap().parse(holder['configurations'] ?? []);
        const rootConfigurations = policySchema.shape.configurations.unwrap().parse(raw['configurations'] ?? []);
        const kept = [...new Set([...rootConfigurations, ...list])].filter(
            (id) => !options.configurations.includes(id),
        );
        for (const configuration of options.configurations) {
            const chain = kept
                .map((id) => requireChain(configuration, id, manifests))
                .find((found) => found !== undefined);
            if (chain)
                throw new GspotError('policy', [
                    `Cannot remove \`${configuration}\`: ${chain.join(' requires ')}. Remove \`${chain[0] ?? configuration}\` first, or keep \`${configuration}\`.`,
                ]);
        }
        const removed = options.configurations.filter((id) => list.includes(id));
        if (removed.length === 0) return;
        holder['configurations'] = list.filter((id) => !removed.includes(id));
        holder['removed_configurations'] = [
            ...new Set([
                ...defaultValue(policySchema.shape.removed_configurations, holder['removed_configurations']),
                ...removed,
            ]),
        ];
    };
    const where = options.scope === undefined ? '' : ` from scope ${options.scope}`;
    const description = `removed ${options.configurations.join(', ')}${where}`;
    const result = await savePolicy(root, {
        input,
        change: mutation,
        summary: description,
        isDryRun: options.isDryRun,
    });
    return result.exitCode === 0 && !result.json.changed ? { ...result, text: 'nothing to remove\n' } : result;
}

/**
 * Registers remove.
 * @param program the commander program
 */
export function registerRemove(program: Program): void {
    program
        .command('remove')
        .argument('<configuration...>', 'Built-in configuration names to remove')
        .summary('Remove configurations')
        .description(
            'Remove configurations from the root selection or from one scope, apply the policy. Run gspot install when the remaining configuration needs tools. gspot refuses to remove a configuration that another selected configuration requires. --dry-run prints the change and writes nothing.',
        )
        .addHelpText('after', commandHelp('remove'))
        .option('--scope <path>', 'Remove the configuration from this scope')
        .option('--dry-run', 'Print the change and write nothing')
        .action(async (configurations, flags, command) => {
            printResult(
                await removeCommand({
                    cwd: commandRoot(command),
                    configurations: configurations,
                    isDryRun: flags.dryRun === true,
                    ...compact({ scope: flags.scope }),
                }),
            );
        });
}

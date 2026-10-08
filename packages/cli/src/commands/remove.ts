// Remove authored configuration choices through the policy transaction.
import { resolve } from 'node:path';
import { compact } from '#cli/platform/objects.ts';
import { findRoot } from '#cli/repository/root.ts';
import { getScopeTable } from '#cli/policy/edit.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { printResult } from '#cli/terminal/messages.ts';
import { savePolicy } from '#cli/commands/save-policy.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { defaultValue } from '#cli/policy/schema/fields.ts';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { requireChain } from '#cli/configurations/select.ts';
import type { Mutation } from '#cli/types/policy/settings.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { assertVersionPin } from '#cli/lifecycle/version-pin.ts';
import type { RemoveOptions } from '#cli/types/commands/remove.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

/**
 * gspot remove: drops one configuration from the root list or from one scope's list.
 * @param options the parsed flags
 * @returns the command result
 */
async function removeCommand(options: RemoveOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertVersionPin(root);
    const manifests = configurationManifests();
    if (manifests.get(options.configuration)?.configuration.kind === 'general')
        throw new GspotError('policy', [
            `The ${options.configuration} configuration follows repository inputs and the selected level. Change coverage with gspot set level, or record a check exception with gspot ignore and a reason.`,
        ]);
    const mutation: Mutation = (raw) => {
        const holder = getScopeTable(raw, options.scope);
        const list = policySchema.shape.configurations.unwrap().parse(holder['configurations'] ?? []);
        const rootConfigurations = policySchema.shape.configurations.unwrap().parse(raw['configurations'] ?? []);
        const kept = [...new Set([...rootConfigurations, ...list])].filter((id) => id !== options.configuration);
        const chain = kept
            .map((id) => requireChain(options.configuration, id, manifests))
            .find((found) => found !== undefined);
        if (chain)
            throw new GspotError('policy', [
                `Cannot remove \`${options.configuration}\`: ${chain.join(' requires ')}. Remove \`${chain[0] ?? options.configuration}\` first, or keep \`${options.configuration}\`.`,
            ]);
        if (!list.includes(options.configuration)) return;
        holder['configurations'] = list.filter((id) => id !== options.configuration);
        const removed = defaultValue(policySchema.shape.removed_configurations, holder['removed_configurations']);
        if (!removed.includes(options.configuration)) removed.push(options.configuration);
        holder['removed_configurations'] = removed;
    };
    const where = options.scope === undefined ? '' : ` from scope ${options.scope}`;
    const description = `removed ${options.configuration}${where}`;
    const result = await savePolicy(root, {
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
        .argument('<configuration>', 'Built-in configuration name to remove')
        .summary('Remove a configuration')
        .description(
            'Remove a configuration from the root selection or from one scope, apply the policy. Run gspot install when the remaining configuration needs tools. gspot refuses to remove a configuration that another selected configuration requires. --dry-run prints the change and writes nothing.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the configuration was removed, or the preview finished.\n- 2: the input was invalid, or remove could not finish.\n\nExample:\ngspot remove bash --dry-run\ngspot remove nextjs --scope apps/web',
        )
        .option('--scope <path>', 'Remove the configuration from this scope')
        .option('--dry-run', 'Print the change and write nothing')
        .action(async (configuration, flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(
                await removeCommand({
                    cwd,
                    configuration: configuration,
                    isDryRun: flags.dryRun === true,
                    ...compact({ scope: flags.scope }),
                }),
            );
        });
}

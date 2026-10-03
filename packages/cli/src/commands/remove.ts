// gspot remove: drop a kit from the root selection or from one scope, apply, and install what the rest need.
import { compact } from '#cli/platform/text.ts';
import { requireChain } from '#cli/kits/select.ts';
import * as messages from '#cli/policy/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { getScopeTable } from '#cli/policy/mutations.ts';
import type { Mutation } from '#cli/types/policy/policy.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { assertPinMatches } from '#cli/lifecycle/version-pin.ts';
import { commitPolicy, installSelection } from '#cli/commands/edit.ts';
import type { Program, CommandResult, RemoveOptions } from '#cli/types/commands/commands.ts';

/**
 * gspot remove: drops one configuration from the root list or from one scope's list.
 * @param o the parsed flags
 * @returns the command result
 */
async function removeCommand(o: RemoveOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const manifests = kitManifests();
    const mutation: Mutation = (raw) => {
        const holder = getScopeTable(raw, o.scope);
        const list = (holder['kits'] as string[] | undefined) ?? [];
        const rootKits = (raw['kits'] as string[] | undefined) ?? [];
        const kept = [...new Set([...rootKits, ...list])].filter((id) => id !== o.kit);
        const chain = kept.map((id) => requireChain(o.kit, id, manifests)).find((found) => found !== undefined);
        if (chain) throw new GspotError('policy', [messages.withoutRequired(o.kit, chain)]);
        if (!list.includes(o.kit)) throw new GspotError('policy', [messages.kitNotListed(o.kit, o.scope)]);
        holder['kits'] = list.filter((id) => id !== o.kit);
    };
    const where = o.scope === undefined ? '' : ` from scope ${o.scope}`;
    const result = await commitPolicy(root, mutation, o.isDryRun, `removed ${o.kit}${where}`);
    return installSelection(root, result);
}

/**
 * Registers remove.
 * @param program the commander program
 */
export function registerRemove(program: Program): void {
    program
        .command('remove <kit>')
        .summary('Remove a kit')
        .description(
            'Remove a kit from the root selection or from one scope, apply the configuration, and install the tools the remaining kits need. gspot refuses to remove a kit that another selected kit requires. --dry-run prints the change and writes nothing.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the kit was removed, or the preview finished.\n- 2: the input was invalid, or remove could not finish.\n\nExample:\ngspot remove bash --dry-run',
        )
        .option('--scope <path>', 'Remove the kit from this scope')
        .option('--dry-run', 'Print the change and write nothing')
        .action(async (configuration, flags, command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                (cwd) =>
                    removeCommand({
                        cwd,
                        kit: configuration,
                        isDryRun: flags.dryRun === true,
                        ...compact({ scope: flags.scope }),
                    }),
                global,
            );
        });
}

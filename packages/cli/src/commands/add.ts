// gspot add: append kits to the root selection or to one scope, apply, and install what they need.
import { unknownKit } from '#cli/kits/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { scopeHolder } from '#cli/policy/mutations.ts';
import { compact, similar } from '#cli/platform/text.ts';
import type { Mutation } from '#cli/types/policy/policy.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { assertPinMatches } from '#cli/lifecycle/version-pin.ts';
import { commitPolicy, installChangedSelection } from '#cli/commands/edit.ts';
import type { Program, AddOptions, CommandResult } from '#cli/types/commands/commands.ts';

/**
 * gspot add: appends kits to the root list or to one scope's list.
 * @param o the parsed flags
 * @returns the command result
 */
async function addCommand(o: AddOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const manifests = kitManifests();
    for (const id of o.kits)
        if (!manifests.has(id)) {
            const known = manifests.keys().toArray();
            throw new GspotError('policy', [unknownKit(id, similar(id, known))]);
        }
    const mutation: Mutation = (raw) => {
        const holder = scopeHolder(raw, o.scope);
        const list = (holder['kits'] as string[] | undefined) ?? [];
        for (const id of o.kits) if (!list.includes(id)) list.push(id);
        holder['kits'] = list;
    };
    const where = o.scope === undefined ? '' : ` to scope ${o.scope}`;
    const result = await commitPolicy(root, mutation, o.isDryRun, `added ${o.kits.join(', ')}${where}`);
    return installChangedSelection(root, result);
}

/**
 * Registers add.
 * @param program the commander program
 */
export function registerAdd(program: Program): void {
    program
        .command('add <kit...>')
        .summary('Add kits')
        .description('Add kits to the root selection or to one scope')
        .addHelpText(
            'after',
            '\nEffects:\nAdds the kits to the root or --scope selection, applies the configuration, and installs the tools the change needs. Kits that a selected kit requires stay selected. --dry-run prints the change and writes nothing.\n\nExit codes:\n- 0: the kits were added, or the preview finished.\n- 2: the input was invalid, or add could not finish.\n\nExample:\ngspot add bash --dry-run',
        )
        .option('--scope <path>', 'Add the kits to this scope')
        .option('--dry-run', 'Print the change and write nothing')
        .action(async (configurations, flags, command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                (cwd) =>
                    addCommand({
                        cwd,
                        kits: configurations,
                        isDryRun: flags.dryRun === true,
                        ...compact({ scope: flags.scope }),
                    }),
                global,
            );
        });
}

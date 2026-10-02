import type { Command } from 'commander';
import { similar } from '#cli/policy/similar.ts';
import { requireChain } from '#cli/kits/select.ts';
import { scopeHolder } from '#cli/policy/write.ts';
import * as messages from '#cli/policy/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { commitPolicy } from '#cli/commands/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { installTools } from '#cli/tools/installation.ts';
import type { Mutation } from '#cli/types/policy/policy.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { textEntry, directoryOf } from '#cli/commands/flags.ts';
import { assertPinMatches } from '#cli/lifecycle/version-pin.ts';
import type { AddOptions, CommandResult, RemoveOptions } from '#cli/types/commands.ts';

async function installChangedSelection(
    root: string,
    changed: Awaited<ReturnType<typeof commitPolicy>>,
): Promise<CommandResult> {
    const { applied, ...result } = changed;
    if (applied === undefined) return result;
    const session = await openSession(root);
    const installed = await installTools(session, true);
    const note = installed === '' ? '' : `${installed}\n`;
    return { ...result, text: `${result.text}${note}Run gspot check to check the selected kits.\n` };
}

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
            throw new GspotError('policy', [messages.unknownKit(id, similar(id, known))]);
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
 * gspot remove: drops one configuration from the root list or from one scope's list.
 * @param o the parsed flags
 * @returns the command result
 */
async function removeCommand(o: RemoveOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const manifests = kitManifests();
    const mutation: Mutation = (raw) => {
        const holder = scopeHolder(raw, o.scope);
        const list = (holder['kits'] as string[] | undefined) ?? [];
        const rootList = (raw['kits'] as string[] | undefined) ?? [];
        const kept = [...new Set([...rootList, ...list])].filter((id) => id !== o.kit);
        const chain = kept.map((id) => requireChain(o.kit, id, manifests)).find((found) => found !== undefined);
        if (chain) throw new GspotError('policy', [messages.withoutRequired(o.kit, chain)]);
        if (!list.includes(o.kit)) throw new GspotError('policy', [messages.kitNotListed(o.kit, o.scope)]);
        holder['kits'] = list.filter((id) => id !== o.kit);
    };
    const where = o.scope === undefined ? '' : ` from scope ${o.scope}`;
    const result = await commitPolicy(root, mutation, o.isDryRun, `removed ${o.kit}${where}`);
    return installChangedSelection(root, result);
}

/**
 * Registers add.
 * @param program the commander program
 */
export function registerAdd(program: Command): void {
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
        .action(async (configurations: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    addCommand({
                        cwd: directoryOf(global),
                        kits: configurations,
                        isDryRun: flags['dryRun'] === true,
                        ...textEntry(flags, 'scope', 'scope'),
                    }),
                global,
            );
        });
}

/**
 * Registers remove.
 * @param program the commander program
 */
export function registerRemove(program: Command): void {
    program
        .command('remove <kit>')
        .summary('Remove a kit')
        .description('Remove a kit from the root selection or from one scope')
        .addHelpText(
            'after',
            '\nEffects:\nRemoves the kit from the root or --scope selection, applies the configuration, and installs the tools the remaining kits need. gspot refuses to remove a kit that another selected kit requires. --dry-run prints the change and writes nothing.\n\nExit codes:\n- 0: the kit was removed, or the preview finished.\n- 2: the input was invalid, or remove could not finish.\n\nExample:\ngspot remove bash --dry-run',
        )
        .option('--scope <path>', 'Remove the kit from this scope')
        .option('--dry-run', 'Print the change and write nothing')
        .action(async (configuration: string, flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    removeCommand({
                        cwd: directoryOf(global),
                        kit: configuration,
                        isDryRun: flags['dryRun'] === true,
                        ...textEntry(flags, 'scope', 'scope'),
                    }),
                global,
            );
        });
}

// Add authored configuration choices through the policy transaction.
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
import type { AddOptions } from '#cli/types/commands/add.ts';
import type { Mutation } from '#cli/types/policy/settings.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { assertVersionPin } from '#cli/lifecycle/version-pin.ts';
import { unknownConfigurations } from '#cli/configurations/errors.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

/**
 * gspot add: appends configurations to the root list or to one scope's list.
 * @param options the parsed flags
 * @returns the command result
 */
async function addCommand(options: AddOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertVersionPin(root);
    const manifests = configurationManifests();
    const [unavailable] = unknownConfigurations(
        options.configurations.map((name) => ({ name })),
        manifests,
    );
    if (unavailable !== undefined) throw new GspotError('policy', [unavailable.message]);
    const general = options.configurations.find((id) => manifests.get(id)?.configuration.kind === 'general');
    if (general !== undefined)
        throw new GspotError('policy', [
            `The ${general} configuration follows repository inputs and the selected level. Change coverage with gspot set level, or record a check exception with gspot ignore and a reason.`,
        ]);
    const mutation: Mutation = (raw) => {
        const holder = getScopeTable(raw, options.scope);
        const list = policySchema.shape.configurations.unwrap().parse(holder['configurations'] ?? []);
        for (const id of options.configurations) if (!list.includes(id)) list.push(id);
        holder['configurations'] = list;
        const removed = defaultValue(policySchema.shape.removed_configurations, holder['removed_configurations']);
        if (holder['removed_configurations'] !== undefined)
            holder['removed_configurations'] = removed.filter((id) => !options.configurations.includes(id));
    };
    const where = options.scope === undefined ? '' : ` to scope ${options.scope}`;
    const description = `added ${options.configurations.join(', ')}${where}`;
    return await savePolicy(root, {
        change: mutation,
        summary: description,
        isDryRun: options.isDryRun,
    });
}

/**
 * Registers add.
 * @param program the commander program
 */
export function registerAdd(program: Program): void {
    program
        .command('add')
        .argument('<configuration...>', 'Built-in configuration names to add')
        .summary('Add configurations')
        .description(
            'Add configurations to the root selection or to one scope, apply the configuration. Run gspot install when the change needs tools. Required configurations are added with them. --dry-run prints the change and writes nothing.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the configurations were added, or the preview finished.\n- 2: the input was invalid, or add could not finish.\n\nExample:\ngspot add bash --dry-run',
        )
        .option('--scope <path>', 'Add the configurations to this scope')
        .option('--dry-run', 'Print the change and write nothing')
        .action(async (configurations, flags, command) => {
            const global = command.optsWithGlobals();
            const cwd = resolve(global.C ?? process.cwd());
            printResult(
                await addCommand({
                    cwd,
                    configurations: configurations,
                    isDryRun: flags.dryRun === true,
                    ...compact({ scope: flags.scope }),
                }),
            );
        });
}

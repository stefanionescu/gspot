// Add authored configuration choices through the policy transaction.
import { GspotError } from '#cli/platform/public.ts';
import { compact } from '#cli/platform/contracts.ts';
import { printResult } from '#cli/terminal/public.ts';
import { savePolicy } from '#cli/commands/contracts.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { assertVersionPin } from '#cli/lifecycle/public.ts';
import { policySchema } from '#cli/policy/schema/public.ts';
import type { AddOptions } from '#cli/types/commands/add.ts';
import type { Mutation } from '#cli/types/policy/settings.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { defaultValue } from '#cli/policy/schema/contracts.ts';
import { findRoot } from '#cli/repository/discovery/contracts.ts';
import { commandHelp, commandRoot } from '#cli/commands/public.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { unknownConfigurations } from '#cli/configurations/errors/public.ts';
import { getScopeTable, preparePolicy } from '#cli/policy/document/contracts.ts';

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
    const input = preparePolicy(root);
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
        input,
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
            'Add configurations to the root selection or to one scope, apply the policy. Run gspot install when the change needs tools. Configurations they require are selected too; gspot.toml lists only the names you give. --dry-run prints the change and writes nothing.',
        )
        .addHelpText('after', commandHelp('add'))
        .option('--scope <path>', 'Add the configurations to this scope')
        .option('--dry-run', 'Print the change and write nothing')
        .action(async (configurations, flags, command) => {
            printResult(
                await addCommand({
                    cwd: commandRoot(command),
                    configurations: configurations,
                    isDryRun: flags.dryRun === true,
                    ...compact({ scope: flags.scope }),
                }),
            );
        });
}

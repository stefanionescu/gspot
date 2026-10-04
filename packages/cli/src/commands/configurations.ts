// Add or remove built-in configurations through one policy, apply, and installation pipeline.
import { resolve } from 'node:path';
import { compact } from '#cli/platform/objects.ts';
import { findRoot } from '#cli/repository/root.ts';
import { getScopeTable } from '#cli/policy/edit.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { printResult } from '#cli/output/messages.ts';
import { installTools } from '#cli/lifecycle/install.ts';
import type { CommandResult } from '#cli/types/output.ts';
import { requireChain } from '#cli/configurations/select.ts';
import type { Mutation } from '#cli/types/policy/settings.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { assertVersionPin } from '#cli/lifecycle/version-pin.ts';
import { unknownConfigurations } from '#cli/configurations/problems.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { commitPolicy, preparePolicy } from '#cli/commands/policy-edit.ts';
import type { AddOptions, RemoveOptions, ConfigurationChange } from '#cli/types/commands/configurations.ts';

// Preview or publish a validated selection change, then install using that same applied session.
async function applyConfigurationChange(root: string, change: ConfigurationChange): Promise<CommandResult> {
    const { mutation, summary, isDryRun } = change;
    if (isDryRun) {
        const proposal = preparePolicy(root, mutation);
        return {
            text: `${summary}\n(dry run: gspot.toml not written)\n`,
            json: { policy: proposal.text, dryRun: true },
            exitCode: 0,
        };
    }
    using log = openOwnership(root);
    const { applied, session, ...result } = await commitPolicy(root, log, mutation, summary);
    if (applied === undefined) return result;
    const { note, exitCode } = await installTools(session, log, { refreshLocks: false });
    const installation = note === '' ? '' : `${note}\n`;
    const next = exitCode === 0 ? 'Run gspot check to check the selected configurations.\n' : '';
    return {
        ...result,
        text: `${result.text}${installation}${next}`,
        json: exitCode === 0 ? result.json : { ...result.json, error: 'installation', message: note },
        exitCode,
    };
}

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
    const mutation: Mutation = (raw) => {
        const holder = getScopeTable(raw, options.scope);
        const list = (holder['configurations'] as string[] | undefined) ?? [];
        for (const id of options.configurations) if (!list.includes(id)) list.push(id);
        holder['configurations'] = list;
    };
    const where = options.scope === undefined ? '' : ` to scope ${options.scope}`;
    const description = `added ${options.configurations.join(', ')}${where}`;
    return await applyConfigurationChange(root, { mutation, summary: description, isDryRun: options.isDryRun });
}

/**
 * gspot remove: drops one configuration from the root list or from one scope's list.
 * @param options the parsed flags
 * @returns the command result
 */
async function removeCommand(options: RemoveOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertVersionPin(root);
    const manifests = configurationManifests();
    const mutation: Mutation = (raw) => {
        const holder = getScopeTable(raw, options.scope);
        const list = (holder['configurations'] as string[] | undefined) ?? [];
        const rootConfigurations = (raw['configurations'] as string[] | undefined) ?? [];
        const kept = [...new Set([...rootConfigurations, ...list])].filter((id) => id !== options.configuration);
        const chain = kept
            .map((id) => requireChain(options.configuration, id, manifests))
            .find((found) => found !== undefined);
        if (chain)
            throw new GspotError('policy', [
                `Cannot remove \`${options.configuration}\`: ${chain.join(' requires ')}. Remove \`${chain[0] ?? options.configuration}\` first, or keep \`${options.configuration}\`.`,
            ]);
        if (!list.includes(options.configuration))
            throw new GspotError('policy', [
                `\`${options.configuration}\` is not in ${options.scope === undefined ? 'the root configurations' : 'the configurations of scope ' + options.scope}, so there is nothing to remove. Run gspot list to see the selected configurations.`,
            ]);
        holder['configurations'] = list.filter((id) => id !== options.configuration);
    };
    const where = options.scope === undefined ? '' : ` from scope ${options.scope}`;
    const description = `removed ${options.configuration}${where}`;
    return await applyConfigurationChange(root, { mutation, summary: description, isDryRun: options.isDryRun });
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
            'Add configurations to the root selection or to one scope, apply the configuration, and install the tools the change needs. Required configurations are added with them. --dry-run prints the change and writes nothing.',
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
            'Remove a configuration from the root selection or from one scope, apply the configuration, and install the tools the remaining configurations need. gspot refuses to remove a configuration that another selected configuration requires. --dry-run prints the change and writes nothing.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the configuration was removed, or the preview finished.\n- 2: the input was invalid, or remove could not finish.\n\nExample:\ngspot remove bash --dry-run',
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

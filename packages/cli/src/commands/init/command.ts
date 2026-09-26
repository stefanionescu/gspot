// The init command: its flags, the profile's answers, and the run from detection to the written setup.
import type { z } from 'zod';
import { Option } from 'commander';
import type { Command } from 'commander';
import { hasPolicy } from '#cli/policy/read.ts';
import { ciSchema } from '#cli/policy/schema.ts';
import { compact } from '#cli/policy/normalize.ts';
import { write } from '#cli/commands/init/write.ts';
import { runnerSchema } from '#cli/policy/runner.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { note, print } from '#cli/output/messages.ts';
import { hooksSchema } from '#cli/repository/hooks.ts';
import { prepare } from '#cli/commands/init/prepare.ts';
import { askConfirmation } from '#cli/commands/prompts.ts';
import { readProfile } from '#cli/policy/profiles/read.ts';
import type { Profile } from '#cli/types/policy/profiles.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { initPlanText } from '#cli/commands/init/plan-text.ts';
import { ALREADY_INSTALLED, UNREADABLE_EXIT } from '#cli/constants/commands/init.ts';
import { directoryOf, listFlag, textEntry, textFlag } from '#cli/platform/arguments.ts';
import type { InitOptions, InitPrepared, InitResult } from '#cli/types/commands/init.ts';

// The rules answer a profile gives: yes or no when it says, nothing when it leaves the question open.
function ruleAnswer(install: boolean | undefined): 'yes' | 'no' | undefined {
    if (install === undefined) return undefined;
    return install ? 'yes' : 'no';
}

// A profile answers the questions a flag did not: its configurations, hooks, workflow, runner and rule files.
function profileAnswers(profile: Profile): Partial<InitOptions> {
    const { tables } = profile;
    const configurations = tables.configurations ?? [];
    const install = tables.rules?.install;
    return compact({
        configurations: configurations.length === 0 ? ['none'] : configurations,
        hooks: tables.hooks === undefined ? 'none' : tables.hooks.tool,
        ci: tables.ci === undefined ? 'none' : tables.ci.provider,
        runner: tables.runner === undefined ? 'none' : tables.runner.tool,
        rules: ruleAnswer(install),
    });
}

function integrationChoice<Value extends string>(
    flags: Record<string, unknown>,
    name: string,
    schema: z.ZodType<Value>,
): Value | 'none' | undefined {
    return flags[name] === false ? 'none' : schema.optional().parse(textFlag(flags, name));
}

function optionsFrom(flags: Record<string, unknown>, global: Record<string, unknown>): InitOptions {
    const lists = {
        configurations: listFlag(flags, 'configurations'),
        without: listFlag(flags, 'without'),
        scopes: listFlag(flags, 'scope'),
    };
    const choices = {
        hooks: integrationChoice(flags, 'hooks', hooksSchema.shape.tool),
        ci: integrationChoice(flags, 'ci', ciSchema.shape.provider),
        runner: integrationChoice(flags, 'runner', runnerSchema.shape.tool),
        rules: flags['rules'] === false ? ('no' as const) : undefined,
        format: textFlag(flags, 'format') as InitOptions['format'],
    };
    const given: Partial<InitOptions> = Object.fromEntries(
        [...Object.entries(lists), ...Object.entries(choices)].filter(([, value]) => value !== undefined),
    ) as Partial<InitOptions>;
    return {
        cwd: directoryOf(global),
        yes: flags['yes'] === true,
        isDryRun: flags['dryRun'] === true,
        json: global['json'] === true,
        install: flags['install'] !== false,
        allowDirty: flags['allowDirty'] === true,
        ...textEntry(flags, 'from', 'from'),
        ...given,
    };
}

// The result of an init that writes nothing: a preview, or a takeover whose configuration could not be read.
function unwritten(root: string, options: InitOptions, prepared: InitPrepared): InitResult | undefined {
    const { plan, policyText } = prepared;
    if (options.isDryRun) {
        if (!options.json) print('--dry-run: nothing written.\n');
        return { text: '', json: { root, plan, policy: policyText, isDryRun: true }, exitCode: 0 };
    }
    if (plan.unread.length === 0) return undefined;
    return {
        text: 'Cannot apply takeover because configuration could not be read. Fix the listed files and run gspot init again.\n',
        json: { root, plan, error: 'unread-configuration', written: false },
        exitCode: UNREADABLE_EXIT,
    };
}

/**
 * Runs init: detection, questions, plan, then writes and installs after acceptance.
 * @param options the init flags
 * @returns the text, the JSON report and the exit code
 */
export async function initCommand(options: InitOptions): Promise<InitResult> {
    const root = findRoot(options.cwd);
    if (hasPolicy(root))
        return { text: ALREADY_INSTALLED, json: { error: 'already-installed' }, exitCode: UNREADABLE_EXIT };
    const profile = options.from === undefined ? undefined : await readProfile(options.from, options.cwd);
    const effective = profile === undefined ? options : { ...profileAnswers(profile), ...options, profile };
    const prepared = await prepare(root, effective);
    const { plan, policyText } = prepared;
    if (!options.json) print(initPlanText(plan));
    const early = unwritten(root, options, prepared);
    if (early !== undefined) return early;
    const isGo = await askConfirmation('Continue?', '--yes', true, options.yes);
    if (!isGo) return { text: 'Nothing written.\n', json: { root, plan, written: false }, exitCode: 0 };
    const written = await write(root, options, prepared);
    note('run gspot check to check this repository; gspot doctor checks the setup');
    return {
        text: written.lines.join('\n'),
        json: {
            root,
            plan,
            policy: policyText,
            install: written.installNote,
        },
        exitCode: written.exitCode,
    };
}

/**
 * Registers init.
 * @param program the commander program
 */
export function registerInit(program: Command): void {
    program
        .command('init')
        .summary('Initialize a repository')
        .description('Read this repository, propose a policy, and write it after a yes')
        .addHelpText(
            'after',
            '\nEffects:\nReads the repository and proposes gspot.toml, generated configuration, selected integrations, and private tool installation. Confirmation or --yes applies the proposal. --dry-run writes nothing. Existing authored configuration is adopted or retained according to ownership rules. Run from the repository you want to configure.\n\nExit codes:\n0: the request completed, including a preview or declined confirmation. 2: invalid input or inability to complete the request.\n\nExample:\ngspot init --yes --configurations bash',
        )
        .option('--yes', 'Take every proposal without asking')
        .option('--from <profile>', 'Install from a profile: a path, an https URL or github:owner/repo')
        .option('--configurations <configurations...>', 'The root configurations instead of the detected ones')
        .option('--without <configurations...>', 'Configurations to leave out of the proposal')
        .option('--scope <path=configurations...>', 'Scopes and their comma-separated configurations')
        .option('--no-install', 'Skip the install step and print the command instead')
        .option('--allow-dirty', 'Run although the working tree has uncommitted changes')
        .addOption(new Option('--hooks <tool>', 'Where hooks go').choices(hooksSchema.shape.tool.options))
        .addOption(new Option('--ci <provider>', 'Write a CI workflow').choices(ciSchema.shape.provider.options))
        .option('--no-hooks', 'Do not install hooks')
        .option('--no-ci', 'Write no CI workflow')
        .option('--no-rules', 'Leave the agent rule files out')
        .addOption(
            new Option('--format <choice>', 'Keep existing or use shipped formatter settings').choices([
                'keep',
                'shipped',
            ]),
        )
        .addOption(new Option('--runner <tool>', 'The task runner').choices(runnerSchema.shape.tool.options))
        .option('--no-runner', 'Write no task-runner configuration')
        .option('--dry-run', 'Print the plan and write nothing')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => initCommand(optionsFrom(flags, global)), global);
        });
}

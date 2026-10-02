// The init command: its flags, the profile's answers, and the run from detection to the written setup.
import { compact } from '#cli/platform/text.ts';
import { hasPolicy } from '#cli/policy/read.ts';
import { ciSchema } from '#cli/policy/schema.ts';
import { write } from '#cli/commands/init/write.ts';
import { Option } from '@commander-js/extra-typings';
import { findRoot } from '#cli/repository/tracked.ts';
import { note, print } from '#cli/output/messages.ts';
import { prepare } from '#cli/commands/init/prepare.ts';
import { askConfirmation } from '#cli/commands/prompts.ts';
import { getProfile } from '#cli/policy/profiles/parse.ts';
import type { Profile } from '#cli/types/policy/profiles.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { EXIT_ERROR } from '#cli/config/platform/platform.ts';
import type { Program } from '#cli/types/commands/commands.ts';
import { initPlanText } from '#cli/commands/init/plan/text.ts';
import { ALREADY_INSTALLED } from '#cli/config/commands/init.ts';
import type { InitResult, InitOptions, InitPrepared } from '#cli/types/commands/init.ts';

// The rules answer a profile gives: yes or no when it says, nothing when it leaves the question open.
function ruleAnswer(install: boolean | undefined): 'yes' | 'no' | undefined {
    if (install === undefined) return undefined;
    return install ? 'yes' : 'no';
}

// A profile answers the questions a flag did not: its kits, hooks, workflow, runner, and rules.
function profileAnswers(profile: Profile): Partial<InitOptions> {
    const { tables } = profile;
    const configurations = tables.kits ?? [];
    const install = tables.rules?.install;
    return compact({
        kits: configurations.length === 0 ? ['none'] : configurations,
        hooks: tables.hooks === undefined ? 'none' : 'gspot',
        ci: tables.ci === undefined ? 'none' : tables.ci.provider,
        runner: tables.runner ?? 'none',
        rules: ruleAnswer(install),
    });
}

// The result of an init that writes nothing: a preview, or an unreadable configuration file.
function unwritten(root: string, options: InitOptions, prepared: InitPrepared): InitResult | undefined {
    const { plan, policyText } = prepared;
    if (options.isDryRun) {
        if (!options.json) print('--dry-run: nothing written.\n');
        return { text: '', json: { root, plan, policy: policyText, dryRun: true }, exitCode: 0 };
    }
    if (plan.unread.length === 0) return undefined;
    return {
        text: 'A configuration file is unreadable. Fix the listed files and run gspot init again.\n',
        json: { root, plan, error: 'unreadable-config', written: false },
        exitCode: EXIT_ERROR,
    };
}

/**
 * Runs init: detection, questions, plan, then writes and installs after acceptance.
 * @param options the init flags
 * @returns the text, the JSON report, and the exit code
 */
export async function initCommand(options: InitOptions): Promise<InitResult> {
    const root = findRoot(options.cwd);
    if (hasPolicy(root))
        return { text: ALREADY_INSTALLED, json: { error: 'already-initialized' }, exitCode: EXIT_ERROR };
    const profile = options.from === undefined ? undefined : await getProfile(options.from, options.cwd);
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
            note: written.installNote,
        },
        exitCode: written.exitCode,
    };
}

/**
 * Registers init.
 * @param program the commander program
 */
export function registerInit(program: Program): void {
    program
        .command('init')
        .summary('Set up gspot in a repository')
        .description(
            'Read the repository, show a plan, and write it when you accept. The plan covers the policy file, the tool configuration, the rules for coding agents, the Git hooks, and the tool installation. With --yes or your answer, gspot writes the plan and installs the tools. It replaces the configuration files of the selected tools; Git keeps the replaced files. init runs no check. --dry-run writes nothing.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the plan was written, shown, or declined.\n- 2: the input was invalid, or init could not finish.\n\nExample:\ngspot init --yes --kits bash',
        )
        .option('--yes', 'Accept the plan without asking')
        .option('--from <profile>', 'Start from a profile: a path, an https URL, or github:owner/repo')
        .option('--kits <kits...>', 'Use these kits at the root instead of the detected ones')
        .option('--scope <path=kits...>', 'Add scopes, each as a path and its comma-separated kits')
        .option('--no-install', 'Skip installing the tools and print the install command')
        .addOption(
            new Option('--ci <provider>', 'Write a CI workflow for this provider').choices(
                ciSchema.shape.provider.options,
            ),
        )
        .option('--no-hooks', 'Install no Git hooks')
        .option('--no-ci', 'Write no CI workflow')
        .option('--no-rules', 'Install no rules for coding agents')
        .option('--no-runner', 'Add gspot to no task runner')
        .option('--dry-run', 'Print the plan and write nothing')
        .action(async (flags, command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                (cwd) =>
                    initCommand({
                        cwd,
                        yes: flags.yes === true,
                        isDryRun: flags.dryRun === true,
                        json: global.json === true,
                        install: flags.install,
                        ...compact({
                            from: flags.from,
                            kits: flags.kits,
                            scopes: flags.scope,
                            hooks: flags.hooks ? undefined : ('none' as const),
                            ci: flags.ci === false ? ('none' as const) : flags.ci,
                            runner: flags.runner ? undefined : ('none' as const),
                            rules: flags.rules ? undefined : ('no' as const),
                        }),
                    }),
                global,
            );
        });
}

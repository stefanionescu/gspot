// The init command: its flags, the template's answers, and the run from detection to the written setup.
import { resolve } from 'node:path';
import { hasPolicy } from '#cli/policy/read.ts';
import { compact } from '#cli/platform/objects.ts';
import { findRoot } from '#cli/repository/root.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { getTemplate } from '#cli/policy/templates.ts';
import { prepare } from '#cli/commands/init/prepare.ts';
import { writeSetup } from '#cli/commands/init/write.ts';
import { initPlanText } from '#cli/commands/init/plan.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { EXIT_ERROR } from '#cli/config/platform/runtime.ts';
import { trimTrailingSlashes } from '#cli/platform/paths.ts';
import type { Program } from '#cli/types/commands/program.ts';
import type { Template } from '#cli/types/policy/templates.ts';
import { ALREADY_INSTALLED } from '#cli/config/commands/init.ts';
import { askConfirmation } from '#cli/commands/init/questions.ts';
import type { InitOptions } from '#cli/types/lifecycle/selection.ts';
import { note, print, printResult } from '#cli/terminal/messages.ts';
import { NO_CONFIGURATIONS } from '#cli/config/lifecycle/selection.ts';
import type { InitJson, InitPrepared } from '#cli/types/commands/init.ts';
import { Option, InvalidArgumentError } from '@commander-js/extra-typings';

// A template answers the questions a flag did not: its configurations, hooks, workflow, runner, and rules.
function templateAnswers(template: Template): Partial<InitOptions> {
    const { tables } = template;
    const configurations = tables.configurations ?? [];
    const install = tables.agent_rules?.enabled;
    return compact({
        configurations: configurations.length === 0 ? [NO_CONFIGURATIONS] : configurations,
        hooks: tables.hooks?.enabled === true,
        ci: tables.ci === undefined ? 'none' : tables.ci.provider,
        runner: tables.runner ?? 'none',
        agentRules: install,
    });
}

// Show the plan before confirmation. Dry runs and unreadable files return immediately.
function presentPlan(root: string, options: InitOptions, prepared: InitPrepared): CommandResult<InitJson> | undefined {
    const { plan, policyText } = prepared;
    print(initPlanText(plan));
    if (options.isDryRun) {
        print('--dry-run: nothing written.\n');
        return { text: '', json: { root, plan, policy: policyText, dryRun: true }, exitCode: 0 };
    }
    if (plan.unread.length === 0) return undefined;
    return {
        text: 'A configuration file is unreadable. Fix the listed files and run gspot init again.\n',
        json: {
            root,
            plan,
            error: 'unreadable-config',
            message: 'A configuration file could not be read. Nothing written.',
            written: false,
        },
        exitCode: EXIT_ERROR,
    };
}

// Commander passes no previous value for the first authored scope argument.
function parseScopeConfigurations(value: string, previous: Map<string, string[]> | undefined): Map<string, string[]> {
    const separator = value.indexOf('=');
    if (separator === -1) throw new InvalidArgumentError('Write each scope as path=configuration,configuration.');
    const path = trimTrailingSlashes(value.slice(0, separator));
    const configurations = value
        .slice(separator + 1)
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== '');
    const scopes = previous ?? new Map<string, string[]>();
    return scopes.set(path, configurations);
}

/**
 * Runs init: detection, questions, plan, then writes and installs after acceptance.
 * @param options the init flags
 * @returns the text, the JSON report, and the exit code
 */
export async function initCommand(options: InitOptions): Promise<CommandResult<InitJson>> {
    const root = findRoot(options.cwd);
    if (hasPolicy(root))
        return {
            text: ALREADY_INSTALLED,
            json: { error: 'already-initialized', message: ALREADY_INSTALLED.trim() },
            exitCode: EXIT_ERROR,
        };
    let effective = options;
    if (options.from !== undefined) {
        const template = await getTemplate(options.from, options.cwd);
        effective = { ...templateAnswers(template), ...options, template };
    }
    const prepared = await prepare(root, effective);
    const { plan, policyText } = prepared;
    const early = presentPlan(root, options, prepared);
    if (early !== undefined) return early;
    const isGo = await askConfirmation('Continue?', '--yes', true, options.yes);
    if (!isGo) return { text: 'Nothing written.\n', json: { root, plan, written: false }, exitCode: 0 };
    const written = await writeSetup(root, { install: options.install }, prepared);
    if (written.exitCode === 0) note('run gspot check to check this repository; gspot doctor checks the setup');
    return {
        text: written.lines.join('\n'),
        json: {
            root,
            plan,
            policy: policyText,
            note: written.installNote,
            ...(written.exitCode === 0 ? {} : { error: 'installation', message: written.installNote }),
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
            '\nExit codes:\n- 0: the plan was written, shown, or declined.\n- 2: the input was invalid, or init could not finish.\n\nExample:\ngspot init --yes --configurations bash',
        )
        .option('--yes', 'Accept the plan without asking')
        .option('--from <template>', 'Start from a template: a path, an https URL, or github:owner/repo')
        .option(
            '--configurations <configurations...>',
            'Override detected project configurations at the root; general checks remain automatic',
        )
        .addOption(
            new Option(
                '--scope-configurations <path=configurations...>',
                'Add scopes, each as a path and its comma-separated configurations',
            ).argParser(parseScopeConfigurations),
        )
        .option('--no-install', 'Skip installing the tools and print the install command')
        .addOption(
            new Option('--ci <provider>', 'Write a CI workflow for this provider').choices(
                policySchema.shape.ci.unwrap().shape.provider.options,
            ),
        )
        .option('--no-hooks', 'Install no Git hooks')
        .option('--no-ci', 'Write no CI workflow')
        .option('--no-rules', 'Install no rules for coding agents')
        .option('--no-task', 'Set up no task runner')
        .option('--dry-run', 'Print the plan and write nothing')
        .action(async (flags, command) => {
            const global = command.optsWithGlobals();
            if (global.json === true && flags.yes !== true)
                throw new GspotError('prompt', [
                    'JSON initialization requires --yes to accept the plan without prompts.',
                ]);
            const cwd = resolve(global.C ?? process.cwd());
            printResult(
                await initCommand({
                    cwd,
                    yes: flags.yes === true,
                    isDryRun: flags.dryRun === true,
                    install: flags.install,
                    ...compact({
                        from: flags.from,
                        configurations: flags.configurations,
                        scopes: flags.scopeConfigurations,
                        hooks: flags.hooks ? undefined : false,
                        ci: flags.ci === false ? ('none' as const) : flags.ci,
                        runner: flags.task ? undefined : ('none' as const),
                        agentRules: flags.rules ? undefined : false,
                    }),
                }),
            );
        });
}

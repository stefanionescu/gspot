import { agentFiles } from '#cli/agents/instructions.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { InstallationError } from '#cli/tools/install-error.ts';
// init: read the repository, propose a policy, print the plan, write it after a yes, install the tools.
import { buildInitPlan, buildProposal } from '#cli/commands/init/plan.ts';
import { askConfigurations, askInitQuestions } from '#cli/commands/init/questions.ts';
import { selectForInit } from '#cli/commands/init/selection.ts';
import { unknownLanguages } from '#cli/configurations/detect.ts';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';
import { gitignoreBlock } from '#cli/emit/managed-blocks.ts';
import { proposedRunnerTasks } from '#cli/emit/runner-tasks.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { applyAll } from '#cli/lifecycle/apply.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { collectCarried, ownedTools, retireReplaced, unownedTools } from '#cli/lifecycle/takeover.ts';
import { detectionText } from '#cli/output/detection.ts';
import { colors, note, print } from '#cli/output/messages.ts';
import { initPlanText } from '#cli/output/plan-text.ts';
import { askConfirmation } from '#cli/output/prompts.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import * as messages from '#cli/policy/messages.ts';
import { compact } from '#cli/policy/normalize.ts';
import { proposeText } from '#cli/policy/propose.ts';
import { hasPolicy, parsePolicyText, PolicyError } from '#cli/policy/read-policy.ts';
import { assertPolicyComplete } from '#cli/policy/validate-policy.ts';
import { readProfile } from '#cli/profile/read.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { workspaceScopes } from '#cli/repository/scopes.ts';
import { findRoot, isGitRepository } from '#cli/repository/tracked.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { openSession } from '#cli/run/session.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { installTools } from '#cli/tools/install-tools.ts';
import { MissingToolError } from '#cli/tools/missing-tool.ts';
import type { TomlTable } from '#cli/types/policy.ts';
import type { Profile } from '#cli/types/profiles.ts';
import { isDeepStrictEqual } from 'node:util';

import type { InitInputs, InitOptions, InitPrepared, InitResult, InitSelection } from '#cli/commands/init/types.ts';
import type { TakeoverPlan } from '#cli/types/ownership.ts';

const ALREADY_INSTALLED =
    'This repository already has a gspot.toml. Run `gspot doctor` to see what changed since the install and the command that applies each change.\n';

function assertCleanTree(root: string, options: InitOptions): void {
    if (options.allowDirty || options.isDryRun) return;
    const status = runBlocking(['git', 'status', '--porcelain'], { cwd: root });
    if (status.code !== 0) throw new Error(`Git status failed (exit ${String(status.code)}): ${status.stderr.trim()}`);
    const changed = status.stdout.split('\n').filter((line) => line.trim() !== '');
    if (changed.length > 0) throw new PolicyError([messages.dirtyTree(changed.length)]);
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
        rules: install === undefined ? undefined : install ? 'yes' : 'no',
    });
}

function optionsFromProfile(options: InitOptions, profile: Profile): InitOptions {
    return { ...profileAnswers(profile), ...options, profile };
}

function profileLine(profile: Profile, selection: InitSelection): NonNullable<TakeoverPlan['profile']> {
    const detected = selection.rootProposals
        .map((proposal) => proposal.configuration)
        .filter((id) => !selection.selectedIds.has(id));
    return { name: profile.tables.profile, digest: profile.digest, selection: profile.tables.selection, detected };
}

// Asks which configurations to keep, and selects again when the person changed the list.
async function chosenSelection(
    inputs: Omit<InitInputs, 'options'>,
    options: InitOptions,
    detected: InitSelection,
): Promise<InitSelection> {
    if (options.json) return detected;
    const kept = await askConfigurations(options, detected, inputs.manifests);
    if (kept === undefined) return detected;
    const configurations = kept.length === 0 ? ['none'] : kept;
    return selectForInit({ ...inputs, options: { ...options, configurations, isListExact: true } });
}

async function prepare(root: string, options: InitOptions): Promise<InitPrepared> {
    const manifests = configurationManifests();
    const repo = await readRepository(root, [], [], []);
    if (repo.hasGit) assertCleanTree(root, options);
    const facts = readManifests(root, repo.files);
    const workspace = workspaceScopes(root, facts);
    const inputs = { root, repo, facts, workspace: workspace.scopes, manifests };
    const detected = selectForInit({ ...inputs, options });
    const tooling = existingTooling(root, repo.files, facts);
    if (!options.json)
        print(
            detectionText({
                files: repo.files,
                proposals: detected.rootProposals,
                scopes: detected.scopes,
                tooling,
                owned: ownedTools(tooling, detected.selectedIds),
                unowned: unownedTools(tooling, detected.selectedIds),
                unknown: unknownLanguages(repo.files, manifests),
                manifests,
            }),
        );
    const selection = await chosenSelection(inputs, options, detected);
    const carried = await collectCarried(
        root,
        tooling,
        selection.selectedIds,
        repo.files.filter((file) => file.nature === 'source').map((file) => file.path),
    );
    const answers = await askInitQuestions(root, options, tooling, carried.formatter);
    const tasks = proposedRunnerTasks(root, answers.runner);
    const proposal = { ...buildProposal(root, selection, answers, carried), runnerTasks: tasks.names };
    const profileTables = options.profile?.tables as TomlTable | undefined;
    const policyText = proposeText(profileTables ? { ...proposal, profileTables } : proposal);
    // The proposal is read the way every later command reads it, before anything is written.
    const policy = parsePolicyText(policyText, 'gspot.toml', root);
    assertPolicyComplete({ policy, text: policyText, path: 'gspot.toml' });
    const everySelected = [...selection.selectedIds]
        .map((id) => manifests.get(id))
        .filter((manifest) => manifest !== undefined);
    const plan = buildInitPlan({
        root,
        tooling,
        everySelected,
        how: selection.how,
        ...(options.profile ? { profile: profileLine(options.profile, selection) } : {}),
        answers,
        ...(policy.runner?.tasks === undefined ? {} : { runnerTasks: policy.runner.tasks }),
        carried,
        agents: policy.rules.install ? agentFiles(root, policy.rules.agents) : [],
        policyLines: policyText.split('\n').length,
    });
    return {
        plan,
        policyText,
        runner: answers.runner,
        removed: carried.removed,
        observed: new Map([...carried.observed, ...tasks.observed]),
    };
}

async function write(
    root: string,
    options: InitOptions,
    prepared: InitPrepared,
): Promise<{ lines: string[]; installNote: string }> {
    return withLifecycleOwner(root, async (owner) => {
        for (const [path, original] of prepared.observed)
            if (!isDeepStrictEqual(owner.read(path), original))
                throw new PolicyError([
                    `Configuration changed after takeover was planned: ${path}. Run gspot init again.`,
                ]);
        const removedPaths = new Set(prepared.removed.map((entry) => entry.path));
        const takeover = new Map([...prepared.observed].filter(([path]) => removedPaths.has(path)));
        owner.replace('gspot.toml', { bytes: Buffer.from(prepared.policyText), mode: 0o644 }, 'policy', true);
        if (isGitRepository(root)) owner.replaceBlock('.gitignore', gitignoreBlock(), 'hash');
        const session = await openSession(root);
        const outputs = emitAll(session, takeover);
        const generated = new Set(
            [...outputs.files, ...outputs.blocks, ...outputs.merges, ...outputs.configurations].map(
                (output) => output.path,
            ),
        );
        const synced = await applyAll(session, takeover);
        const retired = retireReplaced(
            root,
            prepared.removed.filter((entry) => !generated.has(entry.path)),
            prepared.observed,
        );
        synced.notes.push(
            ...retired.preserved.map(
                (path) => `retained ${path}: directory contents or subsequent edits are not authorized for deletion`,
            ),
        );
        let installNote: string;
        try {
            installNote = await installTools(session, options.install);
        } catch (error) {
            if (
                !(error instanceof AggregateError) ||
                !error.errors.every(
                    (failure: unknown) => failure instanceof MissingToolError || failure instanceof InstallationError,
                )
            )
                throw error;
            installNote = `${error.message}\nSetup was written; tool installation is incomplete. Run: gspot install`;
        }
        const { dim } = colors;
        const version = `gspot ${GSPOT_VERSION}`;
        return { lines: ['written: gspot.toml, .gspot/', ...synced.notes, installNote, dim(version), ''], installNote };
    });
}

/**
 * Runs init: detection, questions, plan, then writes and installs after acceptance.
 * @param options the init flags
 * @returns the text, the JSON report and the exit code
 */
export async function initCommand(options: InitOptions): Promise<InitResult> {
    const root = findRoot(options.cwd);
    if (hasPolicy(root)) return { text: ALREADY_INSTALLED, json: { error: 'already-installed' }, exitCode: 2 };
    const effective =
        options.from === undefined
            ? options
            : optionsFromProfile(options, await readProfile(options.from, options.cwd));
    const prepared = await prepare(root, effective);
    const { plan, policyText } = prepared;
    if (!options.json) print(initPlanText(plan));
    if (options.isDryRun) {
        if (!options.json) print('--dry-run: nothing written.\n');
        return { text: '', json: { root, plan, policy: policyText, isDryRun: true }, exitCode: 0 };
    }
    if (plan.unread.length > 0)
        return {
            text: 'Cannot apply takeover because configuration could not be read. Fix the listed files and run gspot init again.\n',
            json: { root, plan, error: 'unread-configuration', written: false },
            exitCode: 2,
        };
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
        exitCode: 0,
    };
}

import { directoryOf, listFlag, textEntry, textFlag } from '#cli/commands/flags.ts';
import { hooksSchema } from '#cli/repository/hooks.ts';
import { ciSchema } from '#cli/schemas/policy.ts';
import { runnerSchema } from '#cli/schemas/runners.ts';
import type { Command } from 'commander';
import { Option } from 'commander';
import type { z } from 'zod';

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

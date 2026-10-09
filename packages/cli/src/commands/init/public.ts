import { posix } from 'node:path';
import { emitAll } from '#cli/generation/public.ts';
import { GspotError } from '#cli/platform/public.ts';
import { readRepository } from '#cli/repository/public.ts';
import { policySchema } from '#cli/policy/schema/public.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { EXIT_ERROR } from '#cli/config/platform/runtime.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { planTakeover } from '#cli/commands/init/takeover.ts';
import { applicableManifests } from '#cli/planning/public.ts';
import type { Program } from '#cli/types/commands/program.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';
import type { Template } from '#cli/types/policy/templates.ts';
import { detectionText } from '#cli/commands/init/detection.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { npmToolNames } from '#cli/configurations/contracts.ts';
import { runGitBlocking } from '#cli/platform/git/contracts.ts';
import { getTemplate } from '#cli/policy/document/contracts.ts';
import { ALREADY_INSTALLED } from '#cli/config/commands/init.ts';
import { getTooling } from '#cli/repository/discovery/public.ts';
import { findRoot } from '#cli/repository/discovery/contracts.ts';
import { selectForInit } from '#cli/lifecycle/selection/public.ts';
import { note, print, printResult } from '#cli/terminal/public.ts';
import { readPackageManifests } from '#cli/repository/contracts.ts';
import { hasPolicy, parseStrictPolicy } from '#cli/policy/public.ts';
import { selectForScope } from '#cli/repository/selection/public.ts';
import { readFormatConfiguration } from '#cli/parsers/tool/public.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import { NO_CONFIGURATIONS } from '#cli/config/lifecycle/selection.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { initPlanText, buildInitPlan } from '#cli/commands/init/plan.ts';
import { compact, trimTrailingSlashes } from '#cli/platform/contracts.ts';
import { Option, InvalidArgumentError } from '@commander-js/extra-typings';
import { scopeOf, plannedScopes } from '#cli/repository/paths/contracts.ts';
import type { Tooling, Repository } from '#cli/types/repository/inventory.ts';
import { commandHelp, commandRoot, openSession } from '#cli/commands/public.ts';
import type { InitInputs, InitOptions, InitSelection } from '#cli/types/lifecycle/selection.ts';
import type { InitJson, Planning, PolicyDraft, InitPrepared } from '#cli/types/commands/init.ts';
import { writeSetup, proposeText, draftPolicy, askQuestions, askConfirmation } from '#cli/commands/init/contracts.ts';

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
        text: 'A tool file is unreadable. Fix the listed files and run gspot init again.\n',
        json: {
            root,
            plan,
            error: 'unreadable-config',
            message: 'A tool file could not be read. Nothing written.',
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

function assertCleanTree(root: string, options: InitOptions): void {
    if (options.isDryRun) return;
    const status = runGitBlocking(root, ['status', '--porcelain']);
    if (status.code !== 0)
        throw new GspotError('selection', [`Git status failed (exit ${String(status.code)}): ${status.stderr.trim()}`]);
    const changed = status.stdout.split('\n').filter((line) => line.trim() !== '');
    if (changed.length > 0)
        throw new GspotError('policy', [
            `The working tree has ${String(changed.length)} uncommitted change(s). Commit or stash them before gspot init: Git then keeps every file init replaces, and you review its changes separately.`,
        ]);
}

// Prints what init found, unless the caller reads JSON.
function printDetection(
    inputs: Omit<InitInputs, 'options'>,
    detected: InitSelection,
    tooling: Tooling,
    applicable: Set<string>,
): void {
    const { repo, manifests } = inputs;
    const tools = [...new Set(tooling.toolFiles.map((config) => config.tool))].toSorted((a, b) => a.localeCompare(b));
    const owned: string[] = [];
    const unowned: string[] = [];
    for (const tool of tools) (applicable.has(tool) ? owned : unowned).push(tool);
    print(
        detectionText({
            files: repo.files,
            detected: detected.detected,
            scopes: detected.scopes,
            tooling,
            owned,
            unowned,
            manifests,
            hasGit: repo.hasGit,
        }),
    );
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
            'Read the repository, show a plan, and write it when you accept. The plan covers gspot.toml, the tool files, the agent rules, the Git hooks, and the tool installation. With --yes or your answer, gspot writes the plan and installs the tools. It replaces the tool files the selected tools already have; Git keeps the replaced files. init runs no check. --dry-run writes nothing.',
        )
        .addHelpText('after', commandHelp('init'))
        .option('--yes', 'Accept the plan without asking')
        .option('--from <template>', 'Start from a template: a path, an https URL, or github:owner/repo[/path][@ref]')
        .option(
            '--configurations <configurations...>',
            'Override detected configurations at the root; general checks remain automatic',
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
        .option('--no-agent-rules', 'Write no agent rules')
        .addOption(
            new Option('--runner <runner>', 'Select a runner').choices(policySchema.shape.runner.unwrap().options),
        )
        .option('--no-runner', 'Set up no runner')
        .option('--dry-run', 'Print the plan and write nothing')
        .action(async (flags, command) => {
            const global = command.optsWithGlobals();
            if (global.json === true && flags.yes !== true)
                throw new GspotError('prompt', [
                    'JSON initialization requires --yes to accept the plan without prompts.',
                ]);
            printResult(
                await initCommand({
                    cwd: commandRoot(command),
                    yes: flags.yes === true,
                    isDryRun: flags.dryRun === true,
                    install: flags.install,
                    ...compact({
                        from: flags.from,
                        configurations: flags.configurations,
                        scopes: flags.scopeConfigurations,
                        hooks: flags.hooks ? undefined : false,
                        ci: flags.ci === false ? ('none' as const) : flags.ci,
                        runner: flags.runner === false ? ('none' as const) : flags.runner,
                        agentRules: flags.agentRules ? undefined : false,
                    }),
                }),
            );
        });
}

/**
 * Reads the repository, asks the questions, and builds the plan init shows before writing.
 * @param root the repository root
 * @param options the init options, with a template's answers folded in
 * @returns the plan, the policy text, and the files it read
 */
export async function prepare(root: string, options: InitOptions): Promise<InitPrepared> {
    const manifests = configurationManifests();
    const repo = await readRepository(root, [], [], []);
    if (repo.hasGit) assertCleanTree(root, options);
    const packageManifests = readPackageManifests(root, repo.files);
    const workspace = plannedScopes(
        repo.files,
        packageManifests,
        [...manifests.values()].flatMap((manifest) => manifest.detect.project_files),
        npmToolNames(manifests.values()),
    );
    const inputs = { root, repo, packageManifests, workspace, manifests };
    const selection = selectForInit({ ...inputs, options });
    const tooling = getTooling(root, repo.files, packageManifests);
    const answers = await askQuestions(root, options, tooling);
    const everySelected = [...selection.selectedIds]
        .map((id) => manifests.get(id))
        .filter((manifest) => manifest !== undefined);
    const draft = draftPolicy(selection, answers);
    const effective = { ...draft, ...compact({ template: options.template }) };
    const formats = await readFormatTables(effective, repo, manifests, packageManifests);
    const policyText = proposeText(effective, repo, manifests, formats);
    const policy = parseStrictPolicy(policyText, root);
    const session = await openSession(root, { policy, text: policyText, path: POLICY_FILE, errors: [] });
    const applicable = applicableManifests(session);
    const tools = new Set(applicable.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    printDetection(inputs, selection, tooling, tools);
    const generated = emitAll(session);
    const replaced = planTakeover(root, tooling, tools, generated.toolFiles);
    const planning: Planning = {
        root,
        hasGit: repo.hasGit,
        index: session.repository.index,
        options,
        tooling,
        selection,
        everySelected,
        answers,
        replaced,
    };
    return {
        plan: buildInitPlan(planning, policy, policyText, applicable, generated),
        policyText,
        removed: replaced.removed,
        read: replaced.read,
    };
}

/**
 * Reads the native formatting fields for the scopes init will configure.
 * @param draft the selected configurations and authored template
 * @param repository the source root and tracked files
 * @param manifests the configuration declarations
 * @param packageManifests the already parsed project dependencies
 * @returns inferred formatting tables, with authored template values retained
 */
export async function readFormatTables(
    draft: PolicyDraft,
    repository: Repository,
    manifests: Map<string, Manifest>,
    packageManifests: PackageManifest[],
): Promise<Map<string, TomlTable>> {
    const selection = {
        configurations: draft.configurations,
        removed_configurations: [],
        scope: Object.fromEntries(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
    return new Map(
        await Promise.all(
            ['', ...draft.scopes.map((scope) => scope.path)].map(async (scope) => {
                const configurations = selectForScope(selection, scope, manifests);
                if (!configurations.some((entry) => entry.configuration.name === 'format')) return [scope, {}] as const;
                const options = await readFormatConfiguration(
                    posix.join(repository.root, scope, 'package.json'),
                    Object.fromEntries(
                        packageManifests
                            .filter((entry) => scopeOf(entry.path, draft.scopes).path === scope)
                            .flatMap((entry) => Object.entries(entry.dependencies)),
                    ),
                );
                if (options === null) return [scope, {}] as const;
                let quotes;
                if (options.singleQuote !== undefined) quotes = options.singleQuote ? 'single' : 'double';
                const fields = compact({
                    indent_width: options.tabWidth,
                    print_width: options.printWidth,
                    quotes,
                });
                return [scope, { format: { ...fields, ...draft.template?.tables.format } }] as const;
            }),
        ),
    );
}

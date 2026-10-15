import { confirm } from '@clack/prompts';
import { compact } from '#cli/objects.ts';
import { GspotError } from '#cli/errors.ts';
import { emitAll } from '#cli/generation/files.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/commands/session.ts';
import { findRoot } from '#cli/repository/find-root.ts';
import { readRepository } from '#cli/repository/read.ts';
import { readTooling } from '#cli/repository/tooling.ts';
import { type Command } from '@commander-js/extra-typings';
import { isInteractive } from '#cli/system/environment.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { print, printResult } from '#cli/terminal/print.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { writeInitFiles } from '#cli/commands/init/write.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { downloadTemplate } from '#cli/settings/templates.ts';
import { detectionText } from '#cli/commands/init/detection.ts';
import { readFormatTables } from '#cli/commands/init/format.ts';
import { selectForInit } from '#cli/commands/init/selection.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { planReplacedFiles } from '#cli/commands/init/replace.ts';
import { type Tooling } from '#cli/types/repository/inventory.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { readText, createReadCache } from '#cli/system/file-reads.ts';
import { initPlanText, buildInitPlan } from '#cli/commands/init/plan.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { NO_CONFIGURATIONS, INIT_TEMPLATE_DEFAULTS } from '#cli/config/commands/init.ts';
import { proposeCi, draftSettings, initSettingsText } from '#cli/commands/init/settings-text.ts';

import type {
    InitJson,
    InitInputs,
    InitAnswers,
    InitOptions,
    InitPrepared,
    InitSelection,
    InitPlanInputs,
} from '#cli/types/commands/init.ts';

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
 * Detect configurations, show the plan, and write the files after acceptance.
 * @param input the init flags
 * @returns the text, the JSON report, and the exit code
 */
async function initCommand(input: InitOptions): Promise<CommandResult<InitJson>> {
    const options =
        input.configurations?.length === 1 && input.configurations[0] === NO_CONFIGURATIONS
            ? { ...input, configurations: [] }
            : input;
    const root = findRoot(options.cwd);
    if (readText(root, SETTINGS_FILE) !== undefined)
        throw new GspotError('settings', [
            'This repository already has a gspot.toml. Run `gspot doctor` to inspect its setup and see suggested commands.',
        ]);
    let effective = options;
    if (options.from !== undefined) {
        const template = await downloadTemplate(options.from, options.cwd);
        effective = { ...options, template };
    }
    const prepared = await planInit(root, effective);
    const { plan, settingsText } = prepared;
    print(initPlanText(plan));
    if (options.isDryRun) {
        print('Dry run: nothing was written.\n');
        return { text: '', json: { root, plan, settings: settingsText, dryRun: true }, exitCode: 0 };
    }
    const isGo = await askConfirmation(options.yes);
    if (!isGo) return { text: 'Nothing written.\n', json: { root, plan, written: false }, exitCode: 0 };
    const written = writeInitFiles(root, prepared);
    written.push('Run gspot install to install the tools and Git hooks.');
    return {
        text: written.join('\n'),
        json: {
            root,
            plan,
            settings: settingsText,
        },
        exitCode: 0,
    };
}

/**
 * Register the init command.
 * @param program the command program
 */
function registerInit(program: Command): void {
    program
        .command('init')
        .summary(COMMAND_HELP.init.summary)
        .description(COMMAND_HELP.init.description)
        .option('--yes', COMMAND_HELP.init.options['--yes'])
        .option('--from <template>', COMMAND_HELP.init.options['--from <template>'])
        .option('--configurations <names...>', COMMAND_HELP.init.options['--configurations <names...>'])
        .option('--dry-run', COMMAND_HELP.init.options['--dry-run'])
        .action(async (flags, command) => {
            if (command.getOptionValue('json') === true && flags.yes !== true && flags.dryRun !== true)
                throw new GspotError('prompt', [
                    '--json needs --yes or --dry-run, because gspot cannot ask while it prints JSON.',
                ]);
            printResult(
                await initCommand({
                    cwd: process.cwd(),
                    yes: flags.yes === true,
                    isDryRun: flags.dryRun === true,
                    ...compact({ from: flags.from, configurations: flags.configurations }),
                }),
            );
        });
}

/**
 * Read the repository and build the plan init shows before writing.
 * @param root the repository root
 * @param options the init options, with a template's answers folded in
 * @returns the plan, the settings text, and the files it read
 */
async function planInit(root: string, options: InitOptions): Promise<InitPrepared> {
    const manifests = configurationManifests();
    const repo = await readRepository(root, {
        declarations: [],
        scopeEntries: [],
        manifests,
        reads: createReadCache(root),
    });
    const packageManifests = repo.dependencyFiles;
    const scopes = repo.scopes;
    const inputs = { root, repo, packageManifests, scopes, manifests };
    const template = options.template === undefined ? INIT_TEMPLATE_DEFAULTS : options.template.tables;
    const { ci: templateCi } = template;
    const hooks = settingsSchema.shape.hooks.unwrap().shape.enabled.parse(template.hooks?.enabled);
    const rules = settingsSchema.shape.rules.unwrap().shape.enabled.parse(template.rules?.enabled);
    const selection = selectForInit({ ...inputs, options });
    const tooling = readTooling(root, repo.files, packageManifests);
    let ci: InitAnswers['ci'] = 'none';
    if (options.template === undefined) ci = proposeCi(root, tooling);
    else if (templateCi?.enabled === true)
        ci = settingsSchema.shape.ci.unwrap().in.shape.provider.parse(templateCi.provider);
    const answers = { hooks, ci, rules };
    const draft = draftSettings(selection, answers);
    const effective = { ...draft, ...compact({ template: options.template }) };
    const formats = readFormatTables(effective, repo, manifests, packageManifests);
    const settingsText = initSettingsText(effective, repo, manifests, formats);
    const settings = parseSettings(settingsText, root);
    const session = await openSession(root, { settings, text: settingsText });
    const everySelected = everyManifest(session.scopes);
    const applicable = session.neededToolManifests;
    const tools = new Set(applicable.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    printDetection(inputs, selection, tooling, tools);
    const generated = emitAll(session);
    const replaced = planReplacedFiles(root, tooling, tools, generated.fileEdits);
    const planning: InitPlanInputs = {
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
        session,
        generated,
        plan: buildInitPlan(planning, settings, settingsText, applicable, generated),
        settingsText,
        deleted: replaced.deleted,
        read: replaced.read,
    };
}

// The plan has one confirmation; --yes accepts it without a terminal.
async function askConfirmation(useDefaults: boolean): Promise<boolean> {
    if (useDefaults) return true;
    if (!isInteractive())
        throw new GspotError('prompt', 'There is no terminal to ask in. Pass --yes to accept the plan.');
    const answer = await confirm({ message: 'Continue?', initialValue: true });
    if (typeof answer !== 'boolean') throw new GspotError('prompt', 'Canceled. Nothing was written.');
    return answer;
}

export { initCommand, registerInit };

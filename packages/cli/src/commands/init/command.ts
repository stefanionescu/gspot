import { isCI } from 'std-env';
import { confirm } from '@clack/prompts';
import { openSession } from '#cli/session.ts';
import { GspotError } from '#cli/system/errors.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { readText } from '#cli/system/files/reads.ts';
import { generate } from '#cli/generation/generate.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { listExpectedPaths } from '#cli/apply/stale.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { readTemplate } from '#cli/settings/templates.ts';
import { type Command } from '@commander-js/extra-typings';
import { print, getColors } from '#cli/system/terminal.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { type FileContents } from '#cli/types/system/files.ts';
import { readFormatTables } from '#cli/commands/init/format.ts';
import { selectForInit } from '#cli/commands/init/selection.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import type { Writer, WritePlan } from '#cli/types/ownership.ts';
import { planReplacedFiles } from '#cli/commands/init/replace.ts';
import { writePlans, openWriter } from '#cli/ownership/writer.ts';
import { findRoot, readRepository } from '#cli/repository/read.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { listSelectedManifests } from '#cli/configurations/select.ts';
import { readExistingTools } from '#cli/repository/existing-tools.ts';
import type { ExistingTools } from '#cli/types/repository/inventory.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { INIT_INSTALL_NOTES, INIT_TEMPLATE_DEFAULTS } from '#cli/config/commands/init.ts';
import { buildInitPlan, formatInitPlan, formatDetection } from '#cli/commands/init/plan.ts';
import { detectCiProvider, buildInitSettings, buildSettingsDraft } from '#cli/commands/init/settings-text.ts';

import {
    type InitJson,
    type InitAnswers,
    type InitOptions,
    type InitPrepared,
    type InitPlanInputs,
    type DetectionSummary,
} from '#cli/types/commands/init.ts';

function buildInitAnswers(root: string, options: InitOptions, existingTools: ExistingTools): InitAnswers {
    const template = options.template === undefined ? INIT_TEMPLATE_DEFAULTS : options.template.tables;
    const { ci: templateCi } = template;
    const hooks = settingsSchema.shape.hooks.unwrap().shape.enabled.parse(template.hooks?.enabled);
    const rules = settingsSchema.shape.rules.unwrap().shape.enabled.parse(template.rules?.enabled);
    let ci: InitAnswers['ci'] = 'none';
    if (options.template === undefined) ci = detectCiProvider(root, existingTools);
    else if (templateCi?.enabled === true)
        ci = settingsSchema.shape.ci.unwrap().in.shape.provider.parse(templateCi.provider);
    return { hooks, ci, rules };
}

/**
 * Detect configurations, show the plan, and write the files after you accept it.
 * @param options the flags and the settings edit choices.
 * @returns the command result.
 */
async function runInitCommand(options: InitOptions): Promise<CommandResult<InitJson>> {
    const root = findRoot(options.cwd);
    if (readText(root, SETTINGS_FILE) !== undefined)
        throw new GspotError(
            'settings',
            'This repository already has a gspot.toml. Run `gspot doctor` to inspect its setup and see suggested commands.',
        );
    let effective = options;
    if (options.from !== undefined) {
        const template = await readTemplate(options.from, options.cwd);
        effective = { ...options, template };
    }
    const prepared = await planInit(root, effective);
    const { plan, settingsText } = prepared;
    print(formatDetection(prepared.detection));
    print(formatInitPlan(plan));
    if (options.isDryRun) {
        print('Dry run: nothing was written.\n');
        return { text: '', json: { root, plan, settings: settingsText, dryRun: true }, exitCode: 0 };
    }
    const accepted = await askConfirmation({ yes: options.yes });
    if (!accepted) return { text: 'Nothing written.\n', json: { root, plan, written: false }, exitCode: 0 };
    const written = writeInitFiles(root, prepared);
    written.push('Next: run gspot install to install the tools and turn on the Git hooks.');
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
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
function registerInit(program: Command, onResult: CommandCompletion): void {
    program
        .command('init')
        .summary(COMMAND_HELP.init.summary)
        .description(COMMAND_HELP.init.description)
        .option('--yes', COMMAND_HELP.init.options['--yes'])
        .option('--dry-run', COMMAND_HELP.init.options['--dry-run'])
        .option('--from <template>', COMMAND_HELP.init.options['--from <template>'])
        .option('--configurations <names...>', COMMAND_HELP.init.options['--configurations <names...>'])
        .option('--no-configurations', COMMAND_HELP.init.options['--no-configurations'])
        .action(async (flags, command) => {
            if (command.getOptionValue('json') === true && flags.yes !== true && flags.dryRun !== true)
                throw new GspotError(
                    'prompt',
                    '--json needs --yes or --dry-run, because gspot cannot ask while it prints JSON.',
                );
            onResult(
                await runInitCommand({
                    cwd: process.cwd(),
                    yes: flags.yes === true,
                    isDryRun: flags.dryRun === true,
                    ...stripUndefined({
                        from: flags.from,
                        configurations: flags.configurations === false ? [] : flags.configurations,
                    }),
                }),
            );
        });
}

/**
 * Read the repository and build the plan that init shows before it writes.
 * @param repositoryRoot the folder whose files decide detection and tool replacement.
 * @param options the flags, with the answers of a template folded in.
 * @returns the plan, the settings text, and the files it read.
 */
async function planInit(repositoryRoot: string, options: InitOptions): Promise<InitPrepared> {
    const reads = createReadCache(repositoryRoot);
    const manifests = readManifests(reads);
    const repository = await readRepository(reads, { declarations: [], scopes: [], manifests });
    const dependencyFiles = repository.dependencyFiles;
    const scopes = repository.scopes;
    const inputs = { root: repositoryRoot, repository, dependencyFiles, scopes, manifests };
    const selection = selectForInit({ ...inputs, options });
    const existingTools = readExistingTools(repositoryRoot, repository.files, dependencyFiles, reads);
    const answers = buildInitAnswers(repositoryRoot, options, existingTools);
    const draft = buildSettingsDraft(selection, answers);
    const effective = { ...draft, ...stripUndefined({ template: options.template }) };
    const formats = readFormatTables(effective, repository, manifests, dependencyFiles);
    const settingsText = buildInitSettings(effective, repository, manifests, formats);
    const settings = parseSettings(settingsText, repositoryRoot, reads);
    const session = await openSession(repositoryRoot, { settings, text: settingsText });
    const everySelected = listSelectedManifests(session.scopes);
    const applicable = session.neededToolManifests;
    const tools = new Set(applicable.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const detectedTools = [...new Set(existingTools.toolFiles.map((toolFile) => toolFile.tool))].toSorted((a, b) =>
        a.localeCompare(b),
    );
    const detection: DetectionSummary = {
        files: repository.files,
        detected: selection.detected,
        scopes: selection.scopes,
        existingTools,
        owned: detectedTools.filter((tool) => tools.has(tool)),
        unowned: detectedTools.filter((tool) => !tools.has(tool)),
        manifests,
        hasGit: repository.hasGit,
    };
    const generated = generate(session);
    const replaced = planReplacedFiles(repositoryRoot, existingTools, tools, generated.fileEdits);
    const planning: InitPlanInputs = {
        reads,
        root: repositoryRoot,
        hasGit: repository.hasGit,
        index: session.repository.index,
        options,
        existingTools,
        selection,
        everySelected,
        answers,
        replaced,
    };
    return {
        detection,
        session,
        generated,
        plan: buildInitPlan(planning, { settings, settingsText, requirements: applicable, generated }),
        settingsText,
        deleted: replaced.deleted,
        read: replaced.read,
    };
}

// The plan has one confirmation; --yes accepts it without a terminal.
async function askConfirmation({ yes }: { yes: boolean }): Promise<boolean> {
    if (yes) return true;
    if (!(process.stdin.isTTY && process.stdout.isTTY && !isCI))
        throw new GspotError('prompt', 'There is no terminal to ask in. Pass --yes to accept the plan.');
    const answer = await confirm({ message: 'Continue?', initialValue: true });
    if (typeof answer !== 'boolean') throw new GspotError('prompt', 'Canceled. Nothing was written.');
    return answer;
}

// Delete a replaced file only when its bytes still match the plan.
function deleteReplacedFiles(
    writer: Writer,
    removed: InitPrepared['deleted'],
    read: ReadonlyMap<string, FileContents | undefined>,
): string[] {
    const kept: string[] = [];
    const plans: WritePlan[] = [];
    for (const entry of removed) {
        const expected = read.get(entry.path);
        // The writer deletes the file only when its bytes still match the reviewed contents.
        if (expected === undefined) kept.push(entry.path);
        else plans.push({ path: entry.path, before: expected, status: 'changed' });
    }
    writePlans(writer, plans);
    return kept;
}

/**
 * Write the settings and generated files, and delete the replaced tool files.
 * @param repositoryRoot the folder where init writes the accepted changes.
 * @param prepared the plan and file reads from planInit.
 * @returns the lines to print.
 */
function writeInitFiles(repositoryRoot: string, prepared: InitPrepared): string[] {
    using writer = openWriter(repositoryRoot);
    const { session, generated } = prepared;
    writeSettings(writer, prepared.settingsText, prepared.read.get(SETTINGS_FILE));
    const destinations = listExpectedPaths(session, generated);
    const applied = writeGeneratedFiles(session, generated, writer, { reviewedOriginals: prepared.read });
    const kept = deleteReplacedFiles(
        writer,
        prepared.deleted.filter((entry) => !destinations.has(entry.path)),
        prepared.read,
    );
    applied.notes.push(...kept.map((path) => `kept ${path}: it changed after init read it`));
    const version = getColors().dim(`gspot ${session.version}`);
    return [
        'written: gspot.toml, .gspot/',
        ...applied.notes.filter((note) => !INIT_INSTALL_NOTES.has(note)),
        version,
        '',
    ];
}
export { registerInit };

import { isCI } from 'std-env';
import { confirm } from '@clack/prompts';
import { openSession } from '#cli/session.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readGitSetting } from '#cli/system/git.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { findText } from '#cli/system/files/reads.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { DRY_RUN_NOTE } from '#cli/config/terminal.ts';
import { generate } from '#cli/generation/generate.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import { print, getColors } from '#cli/system/terminal.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { CI_FILE_LABELS } from '#cli/config/generation/ci.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import { selectForInit } from '#cli/commands/init/selection.ts';
import type { Writer, WritePlan } from '#cli/types/ownership.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { Option, type Command } from '@commander-js/extra-typings';
import { findRoot, readRepository } from '#cli/repository/read.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { readReplacedFiles } from '#cli/commands/init/replaced-files.ts';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import type { ExistingTools } from '#cli/types/repository/existing-tools.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { readLintJobs, readExistingTools } from '#cli/repository/existing-tools.ts';
import { listForeignDisableComments } from '#cli/commands/init/eslint-disable-comments.ts';
import { planInitFiles, formatInitPlan, formatDetection } from '#cli/commands/init/plan.ts';
import { buildInitSettings, buildSettingsDraft } from '#cli/commands/init/settings-text.ts';
import { GITLAB_CI_FILE, GITHUB_WORKFLOWS_FOLDER } from '#cli/config/repository/existing-tools.ts';

import {
    REMOTE_URL_USER,
    REMOTE_URL_SCHEME,
    INIT_INSTALL_NOTES,
    ORIGIN_URL_SETTING,
} from '#cli/config/commands/init.ts';
import type {
    InitJson,
    InitScan,
    InitAnswers,
    InitOptions,
    InitPrepared,
    DetectionSummary,
} from '#cli/types/commands/init.ts';

/**
 * Detect configurations, show the plan, and write the files after you accept it.
 *
 * @param options the flags and the settings edit choices.
 * @returns the command result.
 */
async function runInitCommand(options: InitOptions): Promise<CommandResult<InitJson>> {
    const root = findRoot(options.cwd);
    if (findText(root, SETTINGS_FILE) !== undefined)
        throw new GspotError(
            'settings',
            'This repository already has a gspot.toml. Run `gspot doctor` to inspect its setup and see suggested commands.',
        );
    const prepared = await planInit(root, options);
    const { plan, settingsText } = prepared;
    print(formatDetection(prepared.detection));
    print(formatInitPlan(plan));
    if (options.isDryRun) {
        print(`${DRY_RUN_NOTE}\n`);
        return { text: '', json: { root, plan, settings: settingsText, written: false }, exitCode: 0 };
    }
    const accepted = await askConfirmation({ yes: options.yes });
    if (!accepted)
        return {
            text: 'Nothing written.\n',
            json: { root, plan, settings: settingsText, written: false },
            exitCode: 0,
        };
    const written = writeInitFiles(root, prepared);
    written.push('Next: run gspot install to install the tools and turn on the Git hooks.');
    return {
        text: written.join('\n'),
        json: {
            root,
            plan,
            settings: settingsText,
            written: true,
        },
        exitCode: 0,
    };
}

/**
 * Register the init command.
 *
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
export function registerInit(program: Command, onResult: CommandCompletion): void {
    program
        .command('init')
        .summary(COMMAND_HELP.init.summary)
        .description(COMMAND_HELP.init.description)
        .option('--yes', COMMAND_HELP.init.options['--yes'])
        .option('--dry-run', COMMAND_HELP.init.options['--dry-run'])
        .option('--configurations <names...>', COMMAND_HELP.init.options['--configurations <names...>'])
        .option('--no-configurations', COMMAND_HELP.init.options['--no-configurations'])
        .addOption(new Option('--level <level>', COMMAND_HELP.init.options['--level <level>']).choices(LEVELS))
        .action(async (flags, command) => {
            if (command.getOptionValue('json') === true && flags.yes !== true && flags.dryRun !== true)
                throw new GspotError(
                    'arguments',
                    '--json needs --yes or --dry-run, because gspot cannot ask while it prints JSON.',
                );
            onResult(
                await runInitCommand({
                    cwd: process.cwd(),
                    yes: flags.yes === true,
                    isDryRun: flags.dryRun === true,
                    ...stripUndefined({
                        level: flags.level,
                        configurations: flags.configurations === false ? [] : flags.configurations,
                    }),
                }),
            );
        });
}

/**
 * Read the repository and build the plan that init shows before it writes.
 *
 * @param root the folder whose files decide detection and tool replacement.
 * @param options the flags.
 * @returns the plan, the settings text, and the files it read.
 */
async function planInit(root: string, options: InitOptions): Promise<InitPrepared> {
    const reads = createReadCache(root);
    const configurations = readConfigurations();
    const repository = await readRepository(reads, { generatedPaths: [], scopes: [], configurations });
    const selection = selectForInit({ repository, configurations, options });
    const existingTools = readExistingTools(reads, repository);
    const answers: InitAnswers = { hooks: true, rules: true, ci: detectCiProvider(root, existingTools) };
    const draft = buildSettingsDraft(selection, answers, options);
    const settingsText = buildInitSettings(draft, repository, configurations);
    const settings = parseSettings(settingsText, root);
    const session = await openSession(root, { settingsFile: { settings, text: settingsText } });
    const everySelected = listSelectedConfigurations(session.scopes);
    const applicable = session.neededToolConfigurations;
    const tools = new Set(applicable.flatMap((configuration) => configuration.tools.map((tool) => tool.name)));
    const detectedTools = [...new Set(existingTools.replacedFiles.map((toolFile) => toolFile.tool))].toSorted((a, b) =>
        a.localeCompare(b),
    );
    const detection: DetectionSummary = {
        files: repository.files,
        detected: selection.detected,
        scopes: selection.scopes,
        existingTools,
        owned: detectedTools.filter((tool) => tools.has(tool)),
        unowned: detectedTools.filter((tool) => !tools.has(tool)),
        configurations,
        hasGit: repository.hasGit,
    };
    const generated = generate(session);
    const replaced = readReplacedFiles(root, existingTools, tools, generated.managedKeys);
    const planning: InitScan = {
        reads,
        repository: session.repository,
        options,
        existingTools,
        selection,
        everySelected,
        answers,
        replaced,
        foreignDisableComments: listForeignDisableComments(session),
    };
    const plan = planInitFiles(planning, { settings, settingsText, requirements: applicable, generated });
    return {
        detection,
        session,
        generated,
        plan,
        settingsText,
        deleted: plan.delete,
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
    deleted: InitPrepared['deleted'],
    read: ReadonlyMap<string, FileContents | undefined>,
): string[] {
    const kept: string[] = [];
    const plans: WritePlan[] = [];
    for (const entry of deleted) {
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
 *
 * @param root the folder where init writes the accepted changes.
 * @param prepared the plan and file reads from planInit.
 * @returns the lines to print.
 */
function writeInitFiles(root: string, prepared: InitPrepared): string[] {
    using writer = openWriter(root);
    const { session, generated } = prepared;
    writeSettings(writer, prepared.settingsText, prepared.read.get(SETTINGS_FILE));
    const applied = writeGeneratedFiles(session, generated, writer, { reviewedOriginals: prepared.read });
    const kept = deleteReplacedFiles(writer, prepared.deleted, prepared.read);
    applied.notes.push(...kept.map((path) => `kept ${path}: it changed after init read it`));
    const version = getColors().dim(`gspot ${cliPackage.version}`);
    return [
        'written: gspot.toml, .gspot/',
        ...applied.notes.filter((note) => !INIT_INSTALL_NOTES.has(note)),
        version,
        '',
    ];
}

/**
 * Choose the CI provider from the existing files and the origin host.
 *
 * @param root the folder whose origin remote gives the host when no CI files exist.
 * @param existingTools the tool and CI files that init found.
 * @returns the provider to propose, or none when the repository needs no workflow.
 */
function detectCiProvider(root: string, existingTools: ExistingTools): InitAnswers['ci'] {
    if (readLintJobs(root, existingTools.ci).length > 0) return 'none';
    let existing: InitAnswers['ci'] | undefined;
    if (existingTools.ci.includes(GITLAB_CI_FILE)) existing = 'gitlab';
    else if (existingTools.ci.some((path) => path.startsWith(GITHUB_WORKFLOWS_FOLDER))) existing = 'github';
    if (existing !== undefined) return existing;
    const remote = readGitSetting(root, ORIGIN_URL_SETTING) ?? '';
    const host = remote.replace(REMOTE_URL_SCHEME, '').replace(REMOTE_URL_USER, '');
    return (
        (Object.keys(CI_FILE_LABELS) as (keyof typeof CI_FILE_LABELS)[]).find(
            (provider) => host.startsWith(`${provider}.com:`) || host.startsWith(`${provider}.com/`),
        ) ?? 'none'
    );
}

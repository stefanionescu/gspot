import { isCI } from 'std-env';
import { confirm } from '@clack/prompts';
import { print } from '#cli/system/terminal.ts';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readSettings } from '#cli/settings/read.ts';
import type { Session } from '#cli/types/session.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText } from '#cli/system/files/reads.ts';
import { openSession } from '#cli/planning/session.ts';
import { writePlans } from '#cli/repository/writer.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readTemplate } from '#cli/commands/init/template.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { readRepositorySetup } from '#cli/repository/setup.ts';
import type { SettingsFile } from '#cli/types/settings/file.ts';
import type { WritePlan } from '#cli/types/repository/writer.ts';
import { formatDetection } from '#cli/commands/init/detection.ts';
import { selectForInit } from '#cli/repository/configurations.ts';
import { Option, type Command } from '@commander-js/extra-typings';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { RepositoryListing } from '#cli/types/repository/read.ts';
import { planInitFiles, formatInitPlan } from '#cli/commands/init/plan.ts';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import { DRY_RUN_FLAG, DRY_RUN_NOTE } from '#cli/config/commands/dry-run.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import type { Files, ReadCache, FileContents } from '#cli/types/system/files.ts';
import { listForeignDisableComments } from '#cli/commands/init/eslint-disable-comments.ts';
import { FROM_OPTION, FROM_CONFLICT_MESSAGE } from '#cli/config/commands/init/template.ts';
import { buildInitSettings, buildSettingsDraft } from '#cli/commands/init/settings-text.ts';
import { readRepository, readRepositoryRoot, listRepositoryFiles } from '#cli/repository/read.ts';
import { listCommittedPaths, readConflictingConfigFiles } from '#cli/commands/init/conflicting-config-files.ts';

import type {
    InitJson,
    InitPlan,
    InitScan,
    InitOptions,
    InitPlanning,
    DetectionSummary,
} from '#cli/types/commands/init.ts';
import {
    YES_FLAG,
    LEVEL_OPTION,
    CANCELED_MESSAGE,
    INIT_INSTALL_NOTES,
    WROTE_PLAN_MESSAGE,
    NO_TERMINAL_MESSAGE,
    NEXT_INSTALL_MESSAGE,
    CONFIGURATIONS_OPTION,
    SETTINGS_EXIST_MESSAGE,
    NO_CONFIGURATIONS_FLAG,
    JSON_NEEDS_YES_MESSAGE,
    NOTHING_WRITTEN_MESSAGE,
} from '#cli/config/commands/init/init.ts';

async function runInitCommand(options: InitOptions): Promise<CommandResult<InitJson>> {
    const root = readRepositoryRoot(options.cwd);
    if (findText(root, SETTINGS_FILE) !== undefined) throw new GspotError('settings', SETTINGS_EXIST_MESSAGE);
    const initPlan = await planInit(root, options);
    const { plan, settingsText } = initPlan;
    print(formatDetection(initPlan.detection));
    print(formatInitPlan(plan));
    const json: InitJson = { root, plan, settings: settingsText, written: false };
    if (options.dryRun) {
        print(`${DRY_RUN_NOTE}\n`);
        return { text: '', json, exitCode: 0 };
    }
    const accepted = await askConfirmation({ yes: options.yes });
    if (!accepted) return { text: NOTHING_WRITTEN_MESSAGE, json, exitCode: 0 };
    const written = await writeInitFiles(root, initPlan);
    written.push(NEXT_INSTALL_MESSAGE);
    return { text: written.join('\n'), json: { ...json, written: true }, exitCode: 0 };
}

function assertTemplateFlags(from: string | undefined, configurations: string[] | false | undefined): void {
    if (from === undefined || configurations === undefined) return;
    const flag = configurations === false ? '--no-configurations' : '--configurations';
    throw new GspotError('arguments', `--from ${FROM_CONFLICT_MESSAGE} ${flag}, or edit a copy of the file.`);
}

/**
Register the init command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
export function registerInit(program: Command, onResult: CommandCompletion): void {
    program
        .command('init')
        .summary(COMMAND_HELP.init.summary)
        .description(COMMAND_HELP.init.description)
        .option(FROM_OPTION, COMMAND_HELP.init.options[FROM_OPTION])
        .option(YES_FLAG, COMMAND_HELP.init.options[YES_FLAG])
        .option(DRY_RUN_FLAG, COMMAND_HELP.init.options[DRY_RUN_FLAG])
        .option(CONFIGURATIONS_OPTION, COMMAND_HELP.init.options[CONFIGURATIONS_OPTION])
        .option(NO_CONFIGURATIONS_FLAG, COMMAND_HELP.init.options[NO_CONFIGURATIONS_FLAG])
        .addOption(new Option(LEVEL_OPTION, COMMAND_HELP.init.options[LEVEL_OPTION]).choices(LEVELS))
        .action(async (flags, command) => {
            assertTemplateFlags(flags.from, flags.configurations);
            const template = flags.from === undefined ? undefined : readTemplate(flags.from, process.cwd());
            if (command.getOptionValue('json') === true && flags.yes !== true && flags.dryRun !== true)
                throw new GspotError('arguments', JSON_NEEDS_YES_MESSAGE);
            onResult(
                await runInitCommand({
                    cwd: process.cwd(),
                    yes: flags.yes === true,
                    dryRun: flags.dryRun === true,
                    ...stripUndefined({
                        level: flags.level,
                        template,
                        configurations: flags.configurations === false ? [] : flags.configurations,
                    }),
                }),
            );
        });
}

function assertConflictingFilesCommitted(root: string, paths: string[]): void {
    const committed = listCommittedPaths(root, paths);
    const uncommitted = paths.filter((path) => !committed.has(path));
    if (uncommitted.length > 0)
        throw new GspotError(
            'arguments',
            `init replaces ${uncommitted.join(', ')}, and Git does not hold them unchanged at HEAD. Commit them or move them away, then run gspot init again.`,
        );
}

async function openPlannedSession(
    root: string,
    { reads, listing, settingsFile }: { reads: ReadCache; listing: RepositoryListing; settingsFile: SettingsFile },
): Promise<Session> {
    const bytes = Buffer.from(settingsFile.text);
    reads.sources.set(SETTINGS_FILE, bytes);
    const trackedSettings = {
        path: SETTINGS_FILE,
        executable: false,
        isSymlink: false,
        size: bytes.length,
        prefix: bytes,
    };
    return openSession(root, {
        settingsFile,
        reads,
        listing: { ...listing, files: [...listing.files, trackedSettings] },
    });
}

async function planInit(root: string, options: InitOptions): Promise<InitPlanning> {
    const reads = createReadCache(root);
    const configurationsByName = readConfigurations();
    const listing = await listRepositoryFiles(reads);
    const repository = await readRepository(reads, listing, { generatedPaths: [], scopes: [], configurationsByName });
    const initConfigurations = selectForInit({ repository, configurationsByName, options });
    const repositorySetup = readRepositorySetup(reads, repository);
    const draft = buildSettingsDraft(initConfigurations, options);
    const settingsText = buildInitSettings(draft, repository, configurationsByName);
    const settings = readSettings(settingsText, root);
    const session = await openPlannedSession(root, { reads, listing, settingsFile: { settings, text: settingsText } });
    const everySelected = listSelectedConfigurations(session.scopes);
    const applicable = session.toolConfigurations;
    const tools = new Set(applicable.flatMap((configuration) => configuration.tools.map((tool) => tool.name)));
    const detectedTools = [
        ...new Set(repositorySetup.conflictingConfigFiles.map((configFile) => configFile.tool)),
    ].toSorted((a, b) => compareText(a, b));
    const detection: DetectionSummary = {
        files: repository.files,
        detected: initConfigurations.detected,
        scopes: initConfigurations.scopes,
        repositorySetup,
        owned: detectedTools.filter((tool) => tools.has(tool)),
        unowned: detectedTools.filter((tool) => !tools.has(tool)),
        configurationsByName,
        hasGit: repository.hasGit,
    };
    const generated = generateFiles(session);
    const conflicts = readConflictingConfigFiles(root, repositorySetup, tools, generated.managedKeys);
    assertConflictingFilesCommitted(
        root,
        conflicts.deleted.map(({ path }) => path),
    );
    const planning: InitScan = {
        repository: session.repository,
        repositorySetup,
        configurations: initConfigurations,
        everySelected,
        conflicts,
        foreignDisableComments: listForeignDisableComments(session),
        ...stripUndefined({ template: options.template }),
    };
    const plan = planInitFiles(planning, { settings, settingsText, requirements: applicable, generated });
    return { detection, session, generated, plan, settingsText, reviewed: conflicts.reviewed };
}

async function askConfirmation({ yes }: { yes: boolean }): Promise<boolean> {
    if (yes) return true;
    if (isCI || !(process.stdin.isTTY && process.stderr.isTTY)) throw new GspotError('prompt', NO_TERMINAL_MESSAGE);
    const answer = await confirm({ message: 'Continue?', initialValue: true, output: process.stderr });
    if (typeof answer !== 'boolean') throw new GspotError('prompt', CANCELED_MESSAGE);
    return answer;
}

function deleteConflictingConfigFiles(
    writer: Files,
    deleted: InitPlan['delete'],
    reviewed: ReadonlyMap<string, FileContents | undefined>,
): string[] {
    const kept: string[] = [];
    const plans: WritePlan[] = [];
    for (const file of deleted) {
        if (reviewed.get(file.path) === undefined) kept.push(file.path);
        else plans.push({ path: file.path, status: 'changed' });
    }
    writePlans(writer, plans);
    return kept;
}

async function writeInitFiles(root: string, initPlan: InitPlanning): Promise<string[]> {
    const writer = openFiles(root);
    const { session, generated } = initPlan;
    writeSettings(writer, initPlan.settingsText, initPlan.reviewed.get(SETTINGS_FILE));
    const applied = await writeGeneratedFiles(session, generated, writer, { reviewed: initPlan.reviewed });
    const kept = deleteConflictingConfigFiles(writer, initPlan.plan.delete, initPlan.reviewed);
    applied.notes.push(...kept.map((path) => `kept ${path}: it changed after init read it`));
    return [WROTE_PLAN_MESSAGE, ...applied.notes.filter((note) => !INIT_INSTALL_NOTES.has(note)), ''];
}

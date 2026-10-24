import { isCI } from 'std-env';
import { confirm } from '@clack/prompts';
import { openSession } from '#cli/session.ts';
import { print } from '#cli/system/terminal.ts';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { readGitSetting } from '#cli/system/git.ts';
import type { WritePlan } from '#cli/types/apply.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { findText } from '#cli/system/files/reads.ts';
import { generate } from '#cli/generation/generate.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { DRY_RUN_NOTE } from '#cli/config/commands/apply.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { selectForInit } from '#cli/commands/init/selection.ts';
import { CI_FILE_LABELS } from '#cli/config/commands/doctor.ts';
import { Option, type Command } from '@commander-js/extra-typings';
import { findRoot, readRepository } from '#cli/repository/read.ts';
import { writeGeneratedFiles } from '#cli/apply/files/generated.ts';
import { openWriter, writePlans } from '#cli/apply/write/writer.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { RepositorySetup } from '#cli/types/repository/setup.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { readLintJobs, readRepositorySetup } from '#cli/repository/setup/tools.ts';
import { listForeignDisableComments } from '#cli/commands/init/eslint-disable-comments.ts';
import { planInitFiles, formatInitPlan, formatDetection } from '#cli/commands/init/plan.ts';
import { buildInitSettings, buildSettingsDraft } from '#cli/commands/init/settings-text.ts';
import { GITLAB_CI_FILE, GITHUB_WORKFLOWS_FOLDER } from '#cli/config/repository/setup/tools.ts';
import { listCommittedPaths, readConflictingConfigFiles } from '#cli/commands/init/conflicting-config-files.ts';

import {
    REMOTE_URL_USER,
    REMOTE_URL_SCHEME,
    ORIGIN_URL_SETTING,
    INIT_INSTALL_NOTES,
} from '#cli/config/commands/init/init.ts';
import type {
    InitJson,
    InitScan,
    InitAnswers,
    InitOptions,
    InitPlanning,
    DetectionSummary,
} from '#cli/types/commands/init.ts';

async function runInitCommand(options: InitOptions): Promise<CommandResult<InitJson>> {
    const root = findRoot(options.cwd);
    if (findText(root, SETTINGS_FILE) !== undefined)
        throw new GspotError(
            'settings',
            'This repository already has a gspot.toml. Run `gspot doctor` to inspect its setup and see suggested commands.',
        );
    const initPlan = await planInit(root, options);
    const { plan, settingsText } = initPlan;
    print(formatDetection(initPlan.detection));
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
    const written = await writeInitFiles(root, initPlan);
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
Register the init command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
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

function assertConflictingFilesCommitted(root: string, paths: string[]): void {
    const committed = listCommittedPaths(root, paths);
    const uncommitted = paths.filter((path) => !committed.has(path));
    if (uncommitted.length > 0)
        throw new GspotError(
            'arguments',
            `init replaces ${uncommitted.join(', ')}, and Git does not hold them unchanged at HEAD. Commit them or move them away, then run gspot init again.`,
        );
}

async function planInit(root: string, options: InitOptions): Promise<InitPlanning> {
    const reads = createReadCache(root);
    const configurations = readConfigurations();
    const repository = await readRepository(reads, { generatedPaths: [], scopes: [], configurations });
    const initConfigurations = selectForInit({ repository, configurations, options });
    const repositorySetup = readRepositorySetup(reads, repository);
    const ciProvider = detectCiProvider(root, repositorySetup);
    const answers: InitAnswers = {
        hooks: true,
        rules: true,
        ci: readLintJobs(root, repositorySetup.ci).length > 0 ? 'none' : ciProvider,
    };
    const draft = buildSettingsDraft(initConfigurations, answers, options);
    const settingsText = buildInitSettings(draft, repository, configurations);
    const settings = parseSettings(settingsText, root);
    const session = await openSession(root, { settingsFile: { settings, text: settingsText } });
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
        configurations,
        hasGit: repository.hasGit,
        ciProvider,
    };
    const generated = generate(session);
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
        answers,
        conflicts,
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
        read: conflicts.read,
    };
}

async function askConfirmation({ yes }: { yes: boolean }): Promise<boolean> {
    if (yes) return true;
    if (isCI || !(process.stdin.isTTY && process.stdout.isTTY))
        throw new GspotError('prompt', 'There is no terminal to ask in. Pass --yes to accept the plan.');
    const answer = await confirm({ message: 'Continue?', initialValue: true });
    if (typeof answer !== 'boolean') throw new GspotError('prompt', 'Canceled. Nothing was written.');
    return answer;
}

function deleteConflictingConfigFiles(
    writer: Files,
    deleted: InitPlanning['deleted'],
    read: ReadonlyMap<string, FileContents | undefined>,
): string[] {
    const kept: string[] = [];
    const plans: WritePlan[] = [];
    for (const file of deleted) {
        const expected = read.get(file.path);
        if (expected === undefined) kept.push(file.path);
        else plans.push({ path: file.path, before: expected, status: 'changed' });
    }
    writePlans(writer, plans);
    return kept;
}

async function writeInitFiles(root: string, initPlan: InitPlanning): Promise<string[]> {
    using writer = openWriter(root);
    const { session, generated } = initPlan;
    writeSettings(writer, initPlan.settingsText, initPlan.read.get(SETTINGS_FILE));
    const applied = await writeGeneratedFiles(session, generated, writer, { reviewedOriginals: initPlan.read });
    const kept = deleteConflictingConfigFiles(writer, initPlan.deleted, initPlan.read);
    applied.notes.push(...kept.map((path) => `kept ${path}: it changed after init read it`));
    return ['Wrote the plan above.', ...applied.notes.filter((note) => !INIT_INSTALL_NOTES.has(note)), ''];
}

function detectCiProvider(root: string, repositorySetup: RepositorySetup): InitAnswers['ci'] {
    let previous: InitAnswers['ci'] | undefined;
    if (repositorySetup.ci.includes(GITLAB_CI_FILE)) previous = 'gitlab';
    else if (repositorySetup.ci.some((path) => path.startsWith(GITHUB_WORKFLOWS_FOLDER))) previous = 'github';
    if (previous !== undefined) return previous;
    const remote = readGitSetting(root, ORIGIN_URL_SETTING) ?? '';
    const host = remote.replace(REMOTE_URL_SCHEME, '').replace(REMOTE_URL_USER, '');
    return (
        (Object.keys(CI_FILE_LABELS) as (keyof typeof CI_FILE_LABELS)[]).find(
            (provider) => host.startsWith(`${provider}.com:`) || host.startsWith(`${provider}.com/`),
        ) ?? 'none'
    );
}

import { print } from '#cli/system/terminal.ts';
import { find } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/engine/session.ts';
import { readSettings } from '#cli/settings/read.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { ApplyReport } from '#cli/types/generation.ts';
import { selectForInit } from '#cli/repository/proposals.ts';
import { readTemplate } from '#cli/commands/init/template.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { readRepositorySetup } from '#cli/repository/setup.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { formatDetection } from '#cli/commands/init/detection.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { InvalidArgumentError } from '@commander-js/extra-typings';
import { LEVELS, MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { planInitFiles, formatInitPlan } from '#cli/commands/init/plan.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';
import { readGspotPin, writeGspotPin } from '#cli/repository/javascript/gspot-pin.ts';
import { buildInitSettings, buildSettingsDraft } from '#cli/commands/init/settings.ts';
import { buildStartRunner, detectPackageManager } from '#cli/repository/javascript/package-manager.ts';

import {
    assertFilesCommitted,
    readConflictingConfigs,
    deleteConflictingConfigs,
} from '#cli/commands/init/conflicts.ts';
import type {
    InitJson,
    InitScan,
    InitFlags,
    InitOptions,
    InitPlanning,
    DetectionSummary,
    CommandDefinition,
} from '#cli/types/commands/edits.ts';
import {
    FROM_OPTION,
    LEVEL_OPTION,
    INIT_INSTALL_NOTES,
    WROTE_PLAN_MESSAGE,
    NEXT_INSTALL_MESSAGE,
    FROM_CONFLICT_MESSAGE,
    CONFIGURATIONS_OPTION,
    SETTINGS_EXIST_MESSAGE,
    NO_CONFIGURATIONS_FLAG,
    CONFIGURATION_LIST_SEPARATOR,
} from '#cli/config/commands/edits.ts';

async function runInitCommand(root: string, options: InitOptions): Promise<CommandResult<InitJson>> {
    if (find(root, SETTINGS_FILE) !== undefined) throw new GspotError('arguments', SETTINGS_EXIST_MESSAGE);
    const initPlan = await planInit(root, options);
    const { plan, settingsText } = initPlan;
    print(formatDetection(initPlan.detection));
    print(formatInitPlan(plan, settingsText));
    const json: InitJson = {
        root,
        plan,
        settingsText,
        written: [],
        unchanged: [],
        removed: [],
        updated: [],
        notes: [],
    };
    const applied = await writeInitFiles(root, initPlan);
    const notes = applied.notes.filter((note) => !INIT_INSTALL_NOTES.has(note));
    return {
        text: [WROTE_PLAN_MESSAGE, ...notes, '', NEXT_INSTALL_MESSAGE].join('\n'),
        json: { ...json, ...applied, notes: [...notes, NEXT_INSTALL_MESSAGE] },
        exitCode: 0,
    };
}

function parseConfigurationNames(value: string, previous: string[] | false | undefined): string[] {
    const names = value
        .split(CONFIGURATION_LIST_SEPARATOR)
        .map((name) => name.trim())
        .filter((name) => name !== '');
    if (names.length === 0) throw new InvalidArgumentError('Name at least one configuration.');
    return [...(Array.isArray(previous) ? previous : []), ...names];
}

function assertTemplateFlags(from: string | undefined, configurations: string[] | false | undefined): void {
    if (from === undefined || configurations === undefined) return;
    const flag = configurations === false ? '--no-configurations' : '--configurations';
    throw new GspotError('arguments', FROM_CONFLICT_MESSAGE.replace('{flag}', flag));
}

async function planInit(root: string, options: InitOptions): Promise<InitPlanning> {
    const cache = createRunCache(root);
    const configurationsByName = readConfigurations();
    const listing = await listRepositoryFiles(cache);
    const repository = await readRepository(cache, listing, { generatedPaths: [], scopes: [], configurationsByName });
    const initConfigurations = selectForInit({ repository, configurationsByName, options });
    const repositorySetup = await readRepositorySetup(cache, repository);
    const draft = buildSettingsDraft(initConfigurations, options);
    const settingsText = buildInitSettings(draft, repository, configurationsByName);
    const settings = readSettings(settingsText, root);
    const planned = await openSession(root, { settingsFile: { settings, text: settingsText }, cache, listing });
    const hasPin = readGspotPin(root) !== undefined;
    const hasManifest = readPackageJson(root, PACKAGE_JSON) !== undefined;
    const session = hasPin
        ? planned
        : { ...planned, startRunner: buildStartRunner(hasManifest ? detectPackageManager(root, []).name : 'mise') };
    const pinPath = hasManifest ? PACKAGE_JSON : MISE_CONFIG_FILE;
    const everySelected = listSelectedConfigurations(session.scopes);
    const applicable = session.toolConfigurations;
    const tools = new Set(applicable.flatMap((configuration) => configuration.tools.map((tool) => tool.name)));
    const detectedTools = [...new Set(repositorySetup.conflictingConfigs.map((config) => config.tool))].toSorted(
        (a, b) => compareText(a, b),
    );
    const detection: DetectionSummary = {
        files: repository.files,
        detected: initConfigurations.detected,
        scopes: initConfigurations.scopes,
        repositorySetup,
        owned: detectedTools.filter((tool) => tools.has(tool)),
        unowned: detectedTools.filter((tool) => !tools.has(tool)),
        configurationsByName,
    };
    const generated = buildGeneratedFiles(session);
    const conflicts = readConflictingConfigs(root, repositorySetup, tools, generated.managedKeys);
    assertFilesCommitted(
        root,
        conflicts.deleted.map(({ path }) => path),
    );
    const planning: InitScan = {
        repository: session.repository,
        repositorySetup,
        configurations: initConfigurations,
        scopes: session.scopes,
        everySelected,
        conflicts,
        template: options.template,
        pinPath: hasPin ? undefined : pinPath,
    };
    const plan = planInitFiles(planning, { settings, settingsText, requirements: applicable, generated });
    return { detection, session, generated, plan, settingsText, reviewed: conflicts.reviewed };
}

async function writeInitFiles(root: string, initPlan: InitPlanning): Promise<ApplyReport> {
    const writer = openFiles(root);
    const { session, generated } = initPlan;
    writeSettings(writer, initPlan.settingsText, initPlan.reviewed.get(SETTINGS_FILE));
    if (readGspotPin(root) === undefined) writeGspotPin(writer);
    const applied = await writeGeneratedFiles(session, generated, writer, { reviewed: initPlan.reviewed });
    const kept = deleteConflictingConfigs(writer, initPlan.plan.delete, initPlan.reviewed);
    applied.notes.push(...kept.map((path) => `kept ${path}: it changed after init read it`));
    return applied;
}

export const initCommand: CommandDefinition<[], InitFlags> = {
    name: 'init',
    options: [
        { flags: FROM_OPTION },
        { flags: CONFIGURATIONS_OPTION, parse: parseConfigurationNames },
        { flags: NO_CONFIGURATIONS_FLAG },
        { flags: LEVEL_OPTION, choices: LEVELS },
    ],
    run: async (_arguments, { from, configurations, level }, { root, cwd }) => {
        assertTemplateFlags(from, configurations);
        const template = from === undefined ? undefined : readTemplate(from, cwd);
        return await runInitCommand(root, {
            cwd,
            level,
            template,
            configurations: configurations === false ? [] : configurations,
        });
    },
};

import { compareText } from '#cli/system/text.ts';
import { openSession } from '#cli/engine/session.ts';
import { readSettings } from '#cli/settings/read.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { selectForInit } from '#cli/repository/proposals.ts';
import { planInitFiles } from '#cli/generation/setup/plan.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { readRepositorySetup } from '#cli/repository/setup.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';
import { readGspotPin, writeGspotPin } from '#cli/repository/javascript/gspot-pin.ts';
import { buildInitSettings, buildSettingsDraft } from '#cli/generation/setup/settings.ts';
import { readConflictingConfigs, deleteConflictingConfigs } from '#cli/generation/setup/conflicts.ts';
import { buildStartRunner, detectPackageManager } from '#cli/repository/javascript/package-manager.ts';
import type { InitScan, ApplyReport, InitOptions, InitPlanning, DetectionSummary } from '#cli/types/generation.ts';

/**
Read the repository and work out what init writes, replaces, and leaves. It changes no file.

@param root the repository root.
@param options the template, the level, and the configurations that the user chose.
@returns the plan, with the session and the generated files that write it.
*/
export async function planInit(root: string, options: InitOptions): Promise<InitPlanning> {
    const cache = createRunCache(root);
    const configurationsByName = readConfigurations();
    const listing = await listRepositoryFiles(cache);
    const repository = await readRepository(cache, listing, { generatedPaths: [], scopes: [], configurationsByName });
    const initConfigurations = selectForInit({ repository, configurationsByName, options });
    const repositorySetup = await readRepositorySetup(cache, repository);
    const draft = buildSettingsDraft(initConfigurations, options);
    const settingsText = buildInitSettings(draft, repository, configurationsByName);
    const settings = readSettings(settingsText, root);
    const planned = await openSession(root, { settings, cache, listing });
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
    return {
        detection,
        session,
        generated,
        plan,
        settingsText,
        reviewed: conflicts.reviewed,
        replaced: conflicts.deleted.map(({ path }) => path),
        pinPath: planning.pinPath,
    };
}

/**
Write gspot.toml and the generated files of a plan, and delete the config files that they replace.

@param root the repository root.
@param initPlan what planInit returned.
@returns the files that changed, and the notes.
*/
export async function writeInitFiles(root: string, initPlan: InitPlanning): Promise<ApplyReport> {
    const writer = openFiles(root);
    const { session, generated } = initPlan;
    writeSettings(writer, initPlan.settingsText, initPlan.reviewed.get(SETTINGS_FILE));
    if (readGspotPin(root) === undefined) writeGspotPin(writer);
    const applied = await writeGeneratedFiles(session, generated, writer, { reviewed: initPlan.reviewed });
    const kept = deleteConflictingConfigs(writer, initPlan.plan.delete, initPlan.reviewed);
    applied.notes.push(...kept.map((path) => `kept ${path}: it changed after init read it`));
    return applied;
}

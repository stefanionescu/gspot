import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/tools.ts';
import { openSession } from '#cli/engine/session.ts';
import { readSettings } from '#cli/settings/read.ts';
import { PACKAGE_JSON } from '#cli/config/parsers.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { listReplacedTools } from '#cli/tools/pins.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { readCarry } from '#cli/generation/setup/carry.ts';
import { MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { planInitFiles } from '#cli/generation/setup/plan.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { readRepositorySetup } from '#cli/repository/setup.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { listLintCommands } from '#cli/repository/lint-commands.ts';
import { readPrettierScripts } from '#cli/generation/setup/format.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { selectProposedConfigurations } from '#cli/repository/proposals.ts';
import { readRepository, listRepositoryFiles } from '#cli/repository/read.ts';
import { readGspotPin, writeGspotPin } from '#cli/repository/javascript/gspot-pin.ts';
import { buildInitSettings, buildSettingsDraft } from '#cli/generation/setup/settings.ts';
import { readConflictingConfigs, deleteConflictingConfigs } from '#cli/generation/setup/conflicts.ts';
import { buildStartRunner, detectPackageManager } from '#cli/repository/javascript/package-manager.ts';

import type {
    InitScan,
    ApplyReport,
    InitOptions,
    InitPlanning,
    SettingsPlan,
    PlannedSettings,
} from '#cli/types/generation.ts';

function choosePin(root: string, planned: Session): Pick<InitPlanning, 'session' | 'pinPath'> {
    if (readGspotPin(root) !== undefined) return { session: planned, pinPath: undefined };
    const hasManifest = readPackageJson(root, PACKAGE_JSON) !== undefined;
    const runner = hasManifest ? detectPackageManager(root, []).name : 'mise';
    return {
        session: { ...planned, startRunner: buildStartRunner(runner) },
        pinPath: hasManifest ? PACKAGE_JSON : MISE_CONFIG_FILE,
    };
}

async function planSettings(plan: SettingsPlan): Promise<PlannedSettings> {
    const { root, draft, repository, configurationsByName, conflictingConfigs, sessionOptions } = plan;
    const first = readSettings(buildInitSettings(draft, repository, configurationsByName), root);
    const session = await openSession(root, { settings: first, ...sessionOptions });
    const configurations = session.toolConfigurations;
    const carryover = await readCarry({
        repository,
        conflictingConfigs,
        session,
        configurations,
        tools: new Set(configurations.flatMap((configuration) => configuration.tools.map(({ name }) => name))),
        level: first.level,
        prettierScripts: draft.prettierScripts,
        templateIgnore: (draft.template?.table['ignore'] ?? []) as TomlTable[],
    });
    const settingsText = buildInitSettings({ ...draft, carried: carryover.settings }, repository, configurationsByName);
    const settings = readSettings(settingsText, root);
    return { carryover, settingsText, settings, planned: await openSession(root, { settings, ...sessionOptions }) };
}

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
    const proposed = selectProposedConfigurations({ repository, configurationsByName, options });
    const repositorySetup = await readRepositorySetup(cache, repository);
    const prettierScripts = await readPrettierScripts(root, repository.files, proposed.scopes);
    const { carryover, settingsText, settings, planned } = await planSettings({
        root,
        draft: buildSettingsDraft(proposed, options, prettierScripts),
        repository,
        configurationsByName,
        conflictingConfigs: repositorySetup.conflictingConfigs,
        sessionOptions: { cache, listing },
    });
    const { session, pinPath } = choosePin(root, planned);
    const everySelected = listSelectedConfigurations(session.scopes);
    const applicable = session.toolConfigurations;
    const tools = new Set(applicable.flatMap((configuration) => configuration.tools.map((tool) => tool.name)));
    const detected = [...new Set(repositorySetup.conflictingConfigs.map(({ tool }) => tool))].toSorted(compareText);
    const generated = buildGeneratedFiles(session);
    const conflicts = readConflictingConfigs(root, repositorySetup, {
        tools,
        managedKeys: generated.managedKeys,
        prettierScripts,
    });
    const planning: InitScan = {
        repository: session.repository,
        repositorySetup,
        configurations: proposed,
        scopes: session.scopes,
        everySelected,
        conflicts,
        template: options.template,
        pinPath,
        lintCommands: listLintCommands({ root, files: repository.files, ...listReplacedTools(applicable) }),
        carryover: carryover.rows,
    };
    const plan = planInitFiles(planning, { settings, requirements: applicable, generated });
    return {
        detection: {
            files: repository.files,
            detected: proposed.detected,
            scopes: proposed.scopes,
            repositorySetup,
            owned: detected.filter((tool) => tools.has(tool)),
            unowned: detected.filter((tool) => !tools.has(tool)),
            configurationsByName,
        },
        session,
        generated,
        plan,
        settingsText,
        reviewed: conflicts.reviewed,
        replaced: conflicts.deleted.map(({ path }) => path),
        pinPath,
    };
}

/**
Write gspot.toml and the generated files of a plan, and delete the config files that they replace.

@param root the repository root.
@param initPlan what planInit returned.
*/
export async function writeInitFiles(root: string, initPlan: InitPlanning): Promise<ApplyReport> {
    const writer = openFiles(root);
    const { session, generated } = initPlan;
    writeSettings(writer, initPlan.settingsText, initPlan.reviewed.get(SETTINGS_FILE));
    if (initPlan.pinPath !== undefined) writeGspotPin(writer);
    const applied = await writeGeneratedFiles(session, generated, writer, { reviewed: initPlan.reviewed });
    const kept = deleteConflictingConfigs(writer, initPlan.plan.delete, initPlan.reviewed);
    applied.notes.push(...kept.map((path) => `kept ${path}: it changed after init read it`));
    return applied;
}

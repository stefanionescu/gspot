import { CODE_LANGUAGES } from '#cli/config/configurations/eslint/blocks.ts';
import { MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { listSessionFiles, openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readCarryover } from '#cli/generation/setup/carryover/read.ts';
import { deleteConflictingConfigs, readConflictingConfigs } from '#cli/generation/setup/conflicts.ts';
import { planInitFiles } from '#cli/generation/setup/file-plan.ts';
import { readPrettierScripts } from '#cli/generation/setup/format.ts';
import { buildInitSettings, buildSettingsDraft } from '#cli/generation/setup/settings.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { listToolNames } from '#cli/manifests/read.ts';
import { listSelectedConfigurations } from '#cli/manifests/select.ts';
import { readPackageJson } from '#cli/repository/dependencies.ts';
import { listLintCommands, listOtherFormatScripts } from '#cli/repository/lint-commands.ts';
import { detectPackageManager } from '#cli/repository/package-manager.ts';
import { selectProposedConfigurations } from '#cli/repository/proposals.ts';
import { readRepository } from '#cli/repository/read.ts';
import { listCrlfIndexPaths } from '#cli/repository/revisions/files.ts';
import { readRepositorySetup } from '#cli/repository/setup.ts';
import { buildStartRunner, readGspotPin, writeMisePin, writePackagePin } from '#cli/repository/version-pin.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { readSettings } from '#cli/settings/read.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { includeParentFolders } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import { listReplacedTools } from '#cli/tools/pins.ts';
import type { SessionOptions } from '#cli/types/engine/plan.ts';
import type {
    ApplyReport,
    InitOptions,
    InitPlanning,
    InitScan,
    PlannedSettings,
    SettingsDraft,
} from '#cli/types/generation.ts';
import type { ConflictingConfig, Repository, StartRunner } from '#cli/types/repository.ts';
import type { TomlTable } from '#cli/types/settings.ts';

type SettingsPlan = {
    root: string;
    draft: SettingsDraft;
    repository: Repository;
    conflictingConfigs: ConflictingConfig[];
    sessionOptions: Pick<SessionOptions, 'cache' | 'listing'>;
    startRunner: StartRunner | undefined;
};

/**
Choose where init pins gspot, and the runner that starts it from that pin. A repository that already pins gspot gets
no pin, and its session selects the runner.
*/
function choosePin(
    root: string,
    repository: Repository,
): Pick<SessionOptions, 'startRunner'> & Pick<InitPlanning, 'pinPath'> {
    if (readGspotPin(root) !== undefined) return { startRunner: undefined, pinPath: undefined };
    const manifest = readPackageJson(root, PACKAGE_JSON);
    const hasManifest =
        manifest !== undefined &&
        (Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).length > 0 ||
            repository.files.some(({ tags }) => CODE_LANGUAGES.some((tag) => tags.includes(tag))));
    const runner = hasManifest ? detectPackageManager(root, []).name : 'mise';
    return { startRunner: buildStartRunner(runner, root), pinPath: hasManifest ? PACKAGE_JSON : MISE_CONFIG_FILE };
}

async function planSettings(plan: SettingsPlan): Promise<PlannedSettings & Pick<SettingsDraft, 'template'>> {
    const { root, draft, repository, conflictingConfigs, sessionOptions, startRunner } = plan;
    const first = readSettings(buildInitSettings(draft, repository), root);
    const session = await openSession(root, { settings: first, ...sessionOptions });
    const carryover = await readCarryover({
        repository,
        conflictingConfigs,
        session,
        tools: listToolNames(session.toolConfigurations),
        prettierScripts: draft.prettierScripts,
        trackedPaths: draft.trackedPaths,
        templateIgnore: (draft.template?.table['ignore'] ?? []) as TomlTable[],
    });
    const settingsText = buildInitSettings({ ...draft, carried: carryover.settings }, repository);
    const settings = readSettings(settingsText, root);
    return {
        carryover,
        settingsText,
        settings,
        session: await openSession(root, { settings, ...sessionOptions, startRunner }),
        template: draft.template,
    };
}

/**
Read the repository and work out what init writes, replaces, and leaves. It changes no file.
*/
export async function planInit(root: string, options: InitOptions): Promise<InitPlanning> {
    const cache = createRunCache(root);
    const defaults = { tool_timeout_seconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined) };
    const listing = await listSessionFiles(cache, { settings: defaults });
    const repository = await readRepository(cache, listing, { generatedPaths: [], scopes: [] });
    const proposed = selectProposedConfigurations({ repository, options });
    const repositorySetup = await readRepositorySetup(cache, repository);
    const prettierScripts = await readPrettierScripts(root, repository.files, proposed.scopes);
    const trackedPaths = [...includeParentFolders(repository.files.map(({ path }) => path))];
    const { startRunner, pinPath } = choosePin(root, repository);
    const { carryover, settingsText, settings, session, template } = await planSettings({
        root,
        draft: buildSettingsDraft(proposed, options, { prettierScripts, trackedPaths }),
        repository,
        conflictingConfigs: repositorySetup.conflictingConfigs,
        sessionOptions: { cache, listing },
        startRunner,
    });
    const applicable = session.toolConfigurations;
    const tools = listToolNames(applicable);
    const detected = [...new Set(repositorySetup.conflictingConfigs.map(({ tool }) => tool))].toSorted(compareText);
    const generated = buildGeneratedFiles(session);
    const conflicts = readConflictingConfigs(root, repositorySetup, {
        tools,
        managedKeys: generated.managedKeys,
        prettierScripts,
    });
    const lintSearch = { root, files: repository.files, ...listReplacedTools(applicable) };
    const planning: InitScan = {
        repository: session.repository,
        repositorySetup,
        configurations: proposed,
        scopes: session.scopes,
        everySelected: listSelectedConfigurations(session.scopes),
        conflicts,
        template,
        pinPath,
        lintCommands: [...listLintCommands(lintSearch), ...listOtherFormatScripts(lintSearch)],
        carryover: carryover.rows,
        crlfPaths: await listCrlfIndexPaths(root),
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

export async function writeInitFiles(root: string, initPlan: InitPlanning): Promise<ApplyReport> {
    const writer = openFiles(root);
    const { session, generated } = initPlan;
    writeSettings(writer, initPlan.settingsText, initPlan.reviewed.get(SETTINGS_FILE));
    if (initPlan.pinPath === PACKAGE_JSON) writePackagePin(writer);
    if (initPlan.pinPath === MISE_CONFIG_FILE) writeMisePin(writer);
    const applied = await writeGeneratedFiles(session, generated, writer, { reviewed: initPlan.reviewed });
    const kept = deleteConflictingConfigs(writer, initPlan.plan.deleted, initPlan.reviewed);
    applied.notes.push(...kept.map((path) => `kept ${path}: it changed after init read it`));
    return applied;
}

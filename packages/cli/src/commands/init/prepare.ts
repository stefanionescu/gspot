// What init proposes before anything is written: the detection, the selection, the policy text, and the plan.
import { print } from '#cli/output/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { runGitBlocking } from '#cli/platform/git.ts';
import { openSession } from '#cli/execution/session.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { readRepository } from '#cli/repository/read.ts';
import { buildInitPlan } from '#cli/commands/init/plan.ts';
import { proposedScopes } from '#cli/repository/scopes.ts';
import { selectForInit } from '#cli/lifecycle/selection.ts';
import { getReplaced } from '#cli/commands/init/replaced.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { detectionText } from '#cli/commands/init/detection.ts';
import type { Tooling } from '#cli/types/repository/inventory.ts';
import { npmToolNames } from '#cli/configurations/declarations.ts';
import { NO_CONFIGURATIONS } from '#cli/config/lifecycle/selection.ts';
import { getTooling, isReplaced } from '#cli/configurations/takeover.ts';
import type { Planning, InitPrepared } from '#cli/types/commands/init.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { draftPolicy, proposeText } from '#cli/commands/init/policy-text.ts';
import { applicableManifests } from '#cli/execution/planning/requirements.ts';
import { askQuestions, askConfigurations } from '#cli/commands/init/questions.ts';
import type { InitInputs, InitOptions, InitSelection } from '#cli/types/lifecycle/selection.ts';

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

// Asks which configurations to keep, and selects again when the person changed the list.
async function chosenSelection(
    inputs: Omit<InitInputs, 'options'>,
    options: InitOptions,
    detected: InitSelection,
): Promise<InitSelection> {
    const kept = await askConfigurations(options, detected, inputs.manifests);
    if (kept === undefined) return detected;
    const configurations = kept.length === 0 ? [NO_CONFIGURATIONS] : kept;
    return selectForInit({ ...inputs, options: { ...options, configurations: configurations, isListExact: true } });
}

// Prints what init found, unless the caller reads JSON.
function printDetection(inputs: Omit<InitInputs, 'options'>, detected: InitSelection, tooling: Tooling): void {
    const { repo, manifests } = inputs;
    const tools = [...new Set(tooling.configs.map((config) => config.tool))].toSorted((a, b) => a.localeCompare(b));
    const owned: string[] = [];
    const unowned: string[] = [];
    for (const tool of tools) (isReplaced(tool, detected.selectedIds) ? owned : unowned).push(tool);
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
 * Reads the repository, asks the questions, and builds the plan init shows before writing.
 * @param root the repository root
 * @param options the init options, with a template's answers folded in
 * @returns the plan, the policy text, and the files it read
 */
export async function prepare(root: string, options: InitOptions): Promise<InitPrepared> {
    const manifests = configurationManifests();
    const repo = await readRepository(root, [], [], []);
    if (repo.hasGit) assertCleanTree(root, options);
    const projectManifests = readManifests(root, repo.files);
    const workspace = proposedScopes(
        repo.files,
        projectManifests,
        [...manifests.values()].flatMap((manifest) => manifest.detect.project_files),
        npmToolNames(manifests.values()),
    );
    const inputs = { root, repo, projectManifests, workspace, manifests };
    const detected = selectForInit({ ...inputs, options });
    const tooling = getTooling(root, repo.files, projectManifests);
    printDetection(inputs, detected, tooling);
    const selection = await chosenSelection(inputs, options, detected);
    const replaced = getReplaced(root, tooling, selection.selectedIds);
    const answers = await askQuestions(root, options, tooling);
    const everySelected = [...selection.selectedIds]
        .map((id) => manifests.get(id))
        .filter((manifest) => manifest !== undefined);
    const planning: Planning = {
        root,
        hasGit: repo.hasGit,
        options,
        tooling,
        selection,
        everySelected,
        answers,
        replaced,
    };
    const draft = draftPolicy(selection, answers);
    const templateTables = options.template?.tables as TomlTable | undefined;
    const policyText = proposeText({ ...draft, ...(templateTables === undefined ? {} : { templateTables }) });
    const policy = parseStrictPolicy(policyText, root);
    const session = await openSession(root, { policy, text: policyText, path: POLICY_FILE, problems: [] });
    return {
        plan: buildInitPlan(planning, policy, policyText, applicableManifests(session)),
        policyText,
        removed: replaced.removed,
        read: replaced.read,
    };
}

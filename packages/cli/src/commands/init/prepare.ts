// What init proposes before anything is written: the detection, the selection, the policy text, and the plan.
import { print } from '#cli/terminal/messages.ts';
import { compact } from '#cli/platform/objects.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { runGitBlocking } from '#cli/platform/git.ts';
import { openSession } from '#cli/commands/session.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { readRepository } from '#cli/repository/read.ts';
import { buildInitPlan } from '#cli/commands/init/plan.ts';
import { npmToolNames } from '#cli/configurations/pins.ts';
import { proposedScopes } from '#cli/repository/scopes.ts';
import { selectForInit } from '#cli/lifecycle/selection.ts';
import { getTooling } from '#cli/configurations/takeover.ts';
import { planTakeover } from '#cli/commands/init/takeover.ts';
import { askQuestions } from '#cli/commands/init/questions.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { detectionText } from '#cli/commands/init/detection.ts';
import type { Tooling } from '#cli/types/repository/inventory.ts';
import { applicableManifests } from '#cli/planning/requirements.ts';
import type { Planning, InitPrepared } from '#cli/types/commands/init.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { readPackageManifests } from '#cli/repository/package-manifests.ts';
import { draftPolicy, proposeText } from '#cli/commands/init/policy-text.ts';
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

// Prints what init found, unless the caller reads JSON.
function printDetection(
    inputs: Omit<InitInputs, 'options'>,
    detected: InitSelection,
    tooling: Tooling,
    applicable: Set<string>,
): void {
    const { repo, manifests } = inputs;
    const tools = [...new Set(tooling.configs.map((config) => config.tool))].toSorted((a, b) => a.localeCompare(b));
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
 * Reads the repository, asks the questions, and builds the plan init shows before writing.
 * @param root the repository root
 * @param options the init options, with a template's answers folded in
 * @returns the plan, the policy text, and the files it read
 */
export async function prepare(root: string, options: InitOptions): Promise<InitPrepared> {
    const manifests = configurationManifests();
    const repo = await readRepository(root, [], [], []);
    if (repo.hasGit) assertCleanTree(root, options);
    const packageManifests = readPackageManifests(root, repo.files);
    const workspace = proposedScopes(
        repo.files,
        packageManifests,
        [...manifests.values()].flatMap((manifest) => manifest.detect.project_files),
        npmToolNames(manifests.values()),
    );
    const inputs = { root, repo, packageManifests, workspace, manifests };
    const selection = selectForInit({ ...inputs, options });
    const tooling = getTooling(root, repo.files, packageManifests);
    const answers = await askQuestions(root, options, tooling);
    const everySelected = [...selection.selectedIds]
        .map((id) => manifests.get(id))
        .filter((manifest) => manifest !== undefined);
    const draft = draftPolicy(selection, answers);
    const policyText = proposeText({ ...draft, ...compact({ template: options.template }) }, repo, manifests);
    const policy = parseStrictPolicy(policyText, root);
    const session = await openSession(root, { policy, text: policyText, path: POLICY_FILE, errors: [] });
    const applicable = applicableManifests(session);
    const tools = new Set(applicable.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    printDetection(inputs, selection, tooling, tools);
    const replaced = planTakeover(root, tooling, tools, emitAll(session).configurations);
    const planning: Planning = {
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
        plan: buildInitPlan(planning, policy, policyText, applicable),
        policyText,
        removed: replaced.removed,
        read: replaced.read,
    };
}
